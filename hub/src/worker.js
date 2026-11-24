import { OAuthProvider } from "@cloudflare/workers-oauth-provider";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import {validateConfig,validateSiteId,checkRevision,authorized,isFresh} from "./core.js";

const MAX=16384;
const t=()=>Date.now();
const key=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,"0")).join("");
const sha=async(s)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s))),x=>x.toString(16).padStart(2,"0")).join("");
const esc=(s)=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const head={"Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer","X-Frame-Options":"DENY","Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"};
const json=(obj,status=200)=>Response.json(obj,{status,headers:head});
const html=(s,status=200)=>new Response('<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Site Control Hub</title><style>body{font:15px system-ui,sans-serif;background:#f6f7f4;color:#202c29;max-width:1000px;margin:0 auto;padding:24px}header{border-bottom:1px solid #cdd5d0;padding:8px 0 18px;margin-bottom:24px}h1{font-size:32px;letter-spacing:-1px}h2{margin-top:30px;font-size:20px}section,article{background:white;border:1px solid #dce2dd;border-radius:12px;padding:18px;margin:12px 0}input,select,button,textarea{font:inherit;padding:10px;border:1px solid #bac7be;border-radius:6px;max-width:100%;box-sizing:border-box}button{background:#245c50;color:white;cursor:pointer}label{display:block;margin:8px 0}form.inline{display:inline-block;margin:4px}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f1f3f0;padding:10px}small{color:#52655c}a{color:#245c50}code{overflow-wrap:anywhere}.row{display:flex;flex-wrap:wrap;gap:10px;align-items:center}.warn{color:#895a16}textarea{width:100%;min-height:100px}</style><body><header><small>OWNER WORKSPACE / V2 PREVIEW</small><h1>Site Control Hub</h1><a href="/admin">管理中心</a></header>'+s+'</body></html>',{status,headers:{...head,"Content-Type":"text/html; charset=utf-8"}});
const err=(m,status=400)=>Object.assign(new Error(m),{status});
const redirect=(location,cookie)=>new Response(null,{status:303,headers:{...head,Location:location,...(cookie?{"Set-Cookie":cookie}:{})}});
const cookie=(r,n)=>r.headers.get("cookie")?.split(";").map(x=>x.trim()).find(x=>x.startsWith(n+"="))?.slice(n.length+1)||"";
const secureCookie=(n,v,max)=>n+"="+v+"; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age="+max;
const S="__Host-sc_session",F="__Host-sc_flow";
const q=(e,sql,...a)=>e.DB.prepare(sql).bind(...a);
const first=(e,sql,...a)=>q(e,sql,...a).first();
const rows=async(e,sql,...a)=>(await q(e,sql,...a).all()).results;
const run=(e,sql,...a)=>q(e,sql,...a).run();
async function rate(e,principal,limit){
 const window=Math.floor(t()/60000);
 const hit=await first(e,"INSERT INTO rate_limits(principal,window_start,hits) VALUES(?,?,1) ON CONFLICT(principal) DO UPDATE SET hits=CASE WHEN rate_limits.window_start=excluded.window_start THEN rate_limits.hits+1 ELSE 1 END,window_start=excluded.window_start RETURNING hits",principal,window);
 if(!hit||hit.hits>limit)throw err("rate_limited",429);
}

function need(e){if(!e.DB||!e.OAUTH_KV||!e.OWNER_GITHUB_ID||!e.GITHUB_CLIENT_ID||!e.GITHUB_CLIENT_SECRET)throw err("setup_required",503);}
function origin(r){if(r.headers.get("Origin")!==new URL(r.url).origin)throw err("origin_denied",403);}
async function limitedText(r){
 if(Number(r.headers.get("Content-Length")||0)>MAX)throw err("payload_too_large",413);
 if(!r.body)return "";
 const reader=r.body.getReader();const decoder=new TextDecoder();let size=0,out="";
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX){await reader.cancel();throw err("payload_too_large",413);}out+=decoder.decode(value,{stream:true});}return out+decoder.decode();}finally{reader.releaseLock();}
}
async function body(r){if(!r.headers.get("Content-Type")?.startsWith("application/json"))throw err("content_type_denied",415);const data=await limitedText(r);try{const x=JSON.parse(data);if(!x||typeof x!=="object"||Array.isArray(x))throw Error("invalid");return x}catch{throw err("invalid_json")}}
async function form(r){origin(r);if(!r.headers.get("Content-Type")?.startsWith("application/x-www-form-urlencoded"))throw err("content_type_denied",415);return new URLSearchParams(await limitedText(r));}
async function session(r,e){const raw=cookie(r,S);if(!/^[a-f0-9]{64}$/.test(raw))return null;const hash=await sha(raw);const x=await first(e,"SELECT * FROM sessions WHERE hash=? AND expires_at>?",hash,t());return x&&x.owner_id===String(e.OWNER_GITHUB_ID)?x:null;}
async function owner(r,e){const s=await session(r,e);if(!s)throw err("login_required",401);return s;}
function secureUrl(x){let u;try{u=new URL(x)}catch{throw err("invalid_url")}if(u.protocol!=="https:"||u.username||u.password||u.search||u.hash||x.length>500)throw err("invalid_url");return u.href;}
function normConfig(x){try{return JSON.stringify(validateConfig(x))}catch{throw err("invalid_config")}}
function cleanSite(x){return {id:x.id,name:x.name,url:x.url,revision:x.revision,config:x.config?JSON.parse(x.config):null,last_seen:x.last_seen,status:x.revoked?"revoked":x.expires_at<=t()?"expired":isFresh(x.last_seen,t())?"connected":"not_recently_seen"}}
async function activeSite(e,id){try{validateSiteId(id)}catch{throw err("invalid_site_id")}const s=await first(e,"SELECT * FROM sites WHERE id=?",id);if(!s||s.revoked||s.expires_at<=t())throw err("site_unavailable",404);return s;}
async function siteAuth(r,e,id){const s=await activeSite(e,id);const h=r.headers.get("authorization")||"";if(!/^Bearer [a-f0-9]{64}$/.test(h)||await sha(h.slice(7))!==s.token_hash)throw err("site_auth_denied",401);return s;}
async function grant(e,id,site,mode){const row=await first(e,"SELECT * FROM agents WHERE id=?",id);if(!row)throw err("agent_denied",403);const g={...row,sites:JSON.parse(row.sites),writable_sites:JSON.parse(row.writable_sites),can_propose:row.can_propose===1};if(site&&!authorized(g,site,mode,t())||!site&&(g.revoked||g.expires_at<=t()))throw err("agent_denied",403);return g;}
async function propose(e,site,actor,expected,config,reason){
 const s=await activeSite(e,site);try{checkRevision(expected)}catch{throw err("invalid_revision")};if(s.revision!==expected||!s.config)throw err("stale_or_uninitialized",409);
 if(typeof reason!=="string"||!reason.trim()||reason.length>500)throw err("invalid_reason");
 const next=normConfig(config);if(next===s.config)throw err("no_change");const id=crypto.randomUUID();
 const guard=actor.startsWith("agent:")?" AND EXISTS(SELECT 1 FROM agents a WHERE a.id=? AND a.revoked=0 AND a.expires_at>? AND a.can_propose=1 AND EXISTS(SELECT 1 FROM json_each(a.sites) WHERE value=sites.id) AND EXISTS(SELECT 1 FROM json_each(a.writable_sites) WHERE value=sites.id))":"";
 const args=actor.startsWith("agent:")?[actor.slice(6),t()]:[];
 const result=await run(e,"INSERT INTO proposals(id,site_id,actor,reason,expected_revision,before_config,config,status,created_at,updated_at) SELECT ?,id,?,?,revision,config,?,'pending',?,? FROM sites WHERE id=? AND revision=? AND revoked=0 AND expires_at>?"+guard,id,actor,reason.trim(),next,t(),t(),site,expected,t(),...args);
 if(result.meta.changes!==1)throw err("stale_revision",409);return {id,site_id:site,status:"pending",expected_revision:expected};
}
async function startLogin(r,e,returnPath="/admin"){
 const state=key(),u=new URL(r.url); if(returnPath!=="/admin"&&!returnPath.startsWith("/authorize?"))throw err("invalid_return");
 await run(e,"INSERT INTO login_flows VALUES(?,?,?)",await sha(state),returnPath,t()+600000);
 const p=new URLSearchParams({client_id:e.GITHUB_CLIENT_ID,redirect_uri:u.origin+"/callback",scope:"read:user",state});
 return redirect("https://github.com/login/oauth/authorize?"+p,secureCookie(F,state,600));
}
async function callback(r,e){
 const u=new URL(r.url),state=u.searchParams.get("state")||"",code=u.searchParams.get("code")||"";
 if(!code||!/^[a-f0-9]{64}$/.test(state)||cookie(r,F)!==state)throw err("login_state_invalid",403);
 const flow=await first(e,"DELETE FROM login_flows WHERE hash=? AND expires_at>? RETURNING return_path",await sha(state),t());if(!flow)throw err("login_expired",403);
 const res=await fetch("https://github.com/login/oauth/access_token",{method:"POST",headers:{"Accept":"application/json","Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:e.GITHUB_CLIENT_ID,client_secret:e.GITHUB_CLIENT_SECRET,code,redirect_uri:u.origin+"/callback"}),redirect:"error"});
 if(!res.ok)throw err("login_provider_failed",502);const tok=await res.json();if(!tok.access_token)throw err("login_provider_failed",403);
 const ur=await fetch("https://api.github.com/user",{headers:{Authorization:"Bearer "+tok.access_token,Accept:"application/vnd.github+json","User-Agent":"Site-Control-Hub"},redirect:"error"});
 if(!ur.ok)throw err("identity_check_failed",502);const user=await ur.json();if(String(user.id)!==String(e.OWNER_GITHUB_ID))throw err("owner_only",403);
 const raw=key();await run(e,"INSERT INTO sessions VALUES(?,?,?)",await sha(raw),String(user.id),t()+28800000);
 return redirect(flow.return_path,secureCookie(S,raw,28800));
}
async function consent(r,e){
 const s=await session(r,e);const u=new URL(r.url);
 if(r.method==="GET"){
   const request=await e.OAUTH_PROVIDER.parseAuthRequest(r);
   if(!s)return startLogin(r,e,u.pathname+u.search);
   const client=await e.OAUTH_PROVIDER.lookupClient(request.clientId);
   if(!client)throw err("unknown_client",403);
   const nonce=key();await run(e,"INSERT INTO consent_flows VALUES(?,?,?,?)",await sha(nonce),s.hash,JSON.stringify(request),t()+600000);
   const sites=await rows(e,"SELECT id,name FROM sites WHERE revoked=0 AND expires_at>? ORDER BY name LIMIT 100",t());
   return html("<h2>授权一个AI客户端</h2><p>客户端："+esc(client.clientName||request.clientId)+"</p><p>仅允许选择的网站。AI可以读取安全配置及提交提案，不能审批或执行修改。授权最长30天，可随时撤销。</p><form method='post' action='/authorize'><input type='hidden' name='nonce' value='"+nonce+"'>"+sites.map(x=>"<label><input type='checkbox' name='site' value='"+esc(x.id)+"'> 读取 "+esc(x.name)+" / "+esc(x.id)+"</label><label><input type='checkbox' name='write_site' value='"+esc(x.id)+"'> 允许对该站提交提案（仍需选中读取权限）</label>").join("")+"<label><input type='checkbox' name='propose' value='yes'>允许此客户端获得提出修改的 OAuth 范围（仍需本人审批）</label><button>确认授权</button></form><p><a href='/admin'>取消</a></p>");
 }
 if(r.method!=="POST"||!s)throw err("login_required",401);
 const f=await form(r),nonce=String(f.get("nonce")||"");if(!/^[a-f0-9]{64}$/.test(nonce))throw err("bad_consent");
 const flow=await first(e,"DELETE FROM consent_flows WHERE hash=? AND session_hash=? AND expires_at>? RETURNING request_json",await sha(nonce),s.hash,t());if(!flow)throw err("consent_expired",403);
 const request=JSON.parse(flow.request_json),ids=[...new Set(f.getAll("site").map(String))];if(!ids.length||ids.length>100)throw err("select_sites");
 for(const id of ids)await activeSite(e,id);
 const id=crypto.randomUUID(),canPropose=f.get("propose")==="yes"&&request.scope.includes("control:propose");
 const scope=request.scope.filter(x=>x==="control:read"||x==="offline_access"||x==="control:propose"&&canPropose);
 const writeIds=canPropose?[...new Set(f.getAll("write_site").map(String))].filter(id=>ids.includes(id)):[];
 if(!scope.includes("control:read"))throw err("read_scope_required");
 const client=await e.OAUTH_PROVIDER.lookupClient(request.clientId);
 await run(e,"INSERT INTO agents(id,client_id,label,sites,writable_sites,can_propose,expires_at,revoked) VALUES(?,?,?,?,?,?,?,0)",id,request.clientId,String(client?.clientName||request.clientId).slice(0,120),JSON.stringify(ids),JSON.stringify(writeIds),canPropose?1:0,t()+2592000000);
 try{const result=await e.OAUTH_PROVIDER.completeAuthorization({request,userId:s.owner_id,metadata:{label:"Site Control owner grant"},scope,props:{agentId:id,ownerId:s.owner_id}});return redirect(result.redirectTo);}
 catch(e2){await run(e,"UPDATE agents SET revoked=1 WHERE id=?",id);throw e2;}
}
const fbutton=(action,id,label)=>"<form class='inline' method='post' action='/admin/"+action+"'><input type='hidden' name='id' value='"+esc(id)+"'><button>"+esc(label)+"</button></form>";
async function dashboard(e){
 const sites=await rows(e,"SELECT * FROM sites ORDER BY created_at DESC LIMIT 100");
 const props=await rows(e,"SELECT * FROM proposals ORDER BY created_at DESC LIMIT 100");
 const agents=await rows(e,"SELECT id,label,sites,writable_sites,can_propose,expires_at,revoked FROM agents ORDER BY expires_at DESC LIMIT 100");
 const audit=await rows(e,"SELECT * FROM audit ORDER BY id DESC LIMIT 50");
 return html("<div class='row'><form method='post' action='/logout'><button>退出登录</button></form><small>网站自主连接；AI不能直接应用变更。状态为实际心跳，不是模拟。</small></div><h2>01 / 注册网站</h2><section><form method='post' action='/admin/register'><label>网站ID <input name='id' required placeholder='example-site'></label><label>显示名称 <input name='name' required maxlength='100'></label><label>网站地址（HTTPS，不主动抓取） <input name='url' type='url' required></label><button>创建独立令牌</button></form><small>令牌仅显示一次，有效90天；保存于对应网站服务器的密钥存储。</small></section><h2>02 / 网站与连接</h2>"+(sites.length?sites.map(x=>{const s=cleanSite(x);return "<article><h3>"+esc(s.name)+" <small>"+esc(s.id)+"</small></h3><p>"+esc(s.url)+"</p><p>状态："+esc(s.status)+" · 版本 "+esc(s.revision)+" · 最近心跳 "+esc(s.last_seen?new Date(s.last_seen).toISOString():"尚未连接")+"</p><pre>"+esc(JSON.stringify(s.config,null,2))+"</pre>"+fbutton("rotate",s.id,"轮换令牌")+fbutton("revoke-site",s.id,"撤销连接")+(s.config&&!x.revoked?"<details><summary>本人创建配置提案</summary><form method='post' action='/admin/propose'><input type='hidden' name='id' value='"+esc(s.id)+"'><input type='hidden' name='revision' value='"+s.revision+"'><label>原因 <input name='reason' required maxlength='500'></label><textarea name='config'>"+esc(JSON.stringify(s.config,null,2))+"</textarea><button>保存提案</button></form></details>":"")+"</article>"}).join(""):"<section>暂无网站；未连接不会显示为在线。</section>")+"<h2>03 / 变更审批</h2>"+(props.length?props.map(p=>"<article><strong>"+esc(p.site_id)+" · "+esc(p.status)+"</strong><p>"+esc(p.reason)+" · 提出者 "+esc(p.actor)+" · 预期版本 "+esc(p.expected_revision)+"</p><div class='row'><div><small>当前 / 旧版本</small><pre>"+esc(p.before_config)+"</pre></div><div><small>拟修改</small><pre>"+esc(p.config)+"</pre></div></div>"+(p.status==="pending"?fbutton("approve",p.id,"批准，等待网站执行")+fbutton("reject",p.id,"拒绝"):p.status==="applied"?fbutton("rollback",p.id,"创建恢复旧值的提案"):"")+"</article>").join(""):"<section>暂无提案。</section>")+"<h2>04 / AI授权</h2><p>一个MCP连接入口：<code>/mcp</code>。在客户端添加后，会打开真实OAuth授权界面。每次授权明确选择网站。</p>"+(agents.length?agents.map(a=>"<article>"+esc(a.label)+" · "+esc(a.sites)+" · "+(a.revoked?"已撤销":a.expires_at<=t()?"已过期":a.can_propose?"读取＋提案":"只读")+"<br><small>到期 "+esc(new Date(a.expires_at).toISOString())+"</small>"+fbutton("revoke-agent",a.id,"撤销AI授权")+(!a.revoked&&a.expires_at>t()?"<details><summary>修改此AI的网站权限（无需重新安装）</summary><form method='post' action='/admin/update-agent'><input type='hidden' name='id' value='"+esc(a.id)+"'>"+sites.filter(s=>!s.revoked&&s.expires_at>t()).map(s=>"<label><input type='checkbox' name='site' value='"+esc(s.id)+"' "+(JSON.parse(a.sites).includes(s.id)?"checked":"")+"> 读取 "+esc(s.name)+"</label>"+(a.can_propose?"<label><input type='checkbox' name='write_site' value='"+esc(s.id)+"' "+(JSON.parse(a.writable_sites).includes(s.id)?"checked":"")+"> 提案 "+esc(s.name)+"</label>":"")).join("")+"<button>保存网站权限</button></form></details>":"")+"</article>").join(""):"<section>暂无AI连接。</section>")+"<h2>05 / 审计</h2><form method='post' action='/admin/cleanup'><button>清理过期登录状态与旧限流计数</button></form><small>不删除审计、网站、授权记录或历史提案。</small>"+audit.map(a=>"<p><small>"+esc(new Date(a.at).toISOString())+"</small> "+esc(a.site_id)+" · "+esc(a.action)+" · "+esc(a.subject)+"</p>").join(""));
}
async function adminWrite(r,e,action){
 const admin=await owner(r,e);const f=await form(r),id=String(f.get("id")||"");await rate(e,"owner:"+admin.owner_id,120);
 if(action==="register"||action==="rotate"){
   validateSiteId(id);const token=key(),hash=await sha(token),expiry=t()+7776000000;
   if(action==="register"){const name=String(f.get("name")||"").trim();if(!name||name.length>100)throw err("invalid_name");const url=secureUrl(String(f.get("url")||""));await run(e,"INSERT INTO sites(id,name,url,token_hash,expires_at,created_at) VALUES(?,?,?,?,?,?)",id,name,url,hash,expiry,t());}
   else{const v=await run(e,"UPDATE sites SET token_hash=?,expires_at=?,revoked=0,last_seen=NULL WHERE id=?",hash,expiry,id);if(!v.meta.changes)throw err("not_found",404);}
   return html("<h2>网站连接令牌 · 仅此一次</h2><p>将以下值放进网站服务端 Secret，切勿放到浏览器或 Git。</p><pre>"+esc("SITE_ID="+id+"\nHUB_URL="+new URL(r.url).origin+"\nSITE_TOKEN="+token)+"</pre><p>90天有效。关闭页面后不能重新读取，丢失可轮换。</p><a href='/admin'>返回</a>");
 }
 if(action==="revoke-site"){await run(e,"UPDATE sites SET revoked=1,last_seen=NULL WHERE id=?",validateSiteId(id));}
 else if(action==="cleanup"){const now=t();await e.DB.batch([q(e,"DELETE FROM sessions WHERE expires_at<=?",now),q(e,"DELETE FROM login_flows WHERE expires_at<=?",now),q(e,"DELETE FROM consent_flows WHERE expires_at<=?",now),q(e,"DELETE FROM rate_limits WHERE window_start<?",Math.floor(now/60000)-1440),q(e,"INSERT INTO audit(action,subject,at) VALUES(?,?,?)","maintenance:cleanup","expired_ephemeral_state",now)]);}
 else if(action==="revoke-agent"){await run(e,"UPDATE agents SET revoked=1 WHERE id=?",id);}
 else if(action==="update-agent"){
   const a=await first(e,"SELECT * FROM agents WHERE id=? AND revoked=0 AND expires_at>?",id,t());if(!a)throw err("grant_unavailable",404);
   const ids=[...new Set(f.getAll("site").map(String))];if(ids.length>100)throw err("too_many_sites");
   for(const site of ids)await activeSite(e,site);
   const writes=a.can_propose?[...new Set(f.getAll("write_site").map(String))].filter(site=>ids.includes(site)):[];
   const v=await run(e,"UPDATE agents SET sites=?,writable_sites=? WHERE id=? AND revoked=0 AND expires_at>?",JSON.stringify(ids),JSON.stringify(writes),id,t());if(v.meta.changes!==1)throw err("grant_unavailable",409);
 }
 else if(action==="propose"){let c;try{c=JSON.parse(String(f.get("config")))}catch{throw err("invalid_json")}await propose(e,id,"owner",Number(f.get("revision")),c,String(f.get("reason")||""));}
 else if(action==="approve"){const v=await run(e,"UPDATE proposals SET status='approved',updated_at=? WHERE id=? AND status='pending' AND EXISTS(SELECT 1 FROM sites s WHERE s.id=proposals.site_id AND s.revision=proposals.expected_revision AND s.revoked=0 AND s.expires_at>?) AND NOT EXISTS(SELECT 1 FROM proposals p WHERE p.site_id=proposals.site_id AND p.status='approved')",t(),id,t());if(v.meta.changes!==1)throw err("stale_or_conflicting_approval",409);}
 else if(action==="reject"){const v=await run(e,"UPDATE proposals SET status='rejected',updated_at=? WHERE id=? AND status='pending'",t(),id);if(v.meta.changes!==1)throw err("not_pending",409);}
 else if(action==="rollback"){const p=await first(e,"SELECT * FROM proposals WHERE id=? AND status='applied'",id);if(!p)throw err("not_found",404);const s=await activeSite(e,p.site_id);await propose(e,s.id,"owner",s.revision,JSON.parse(p.before_config),"Restore previous values from "+id);}
 else throw err("unknown_action",404);
 return redirect("/admin");
}
async function siteApi(r,e,id,action){
 if(r.method!=="POST")throw err("method_denied",405);
 const s=await siteAuth(r,e,id),b=await body(r);await rate(e,"site:"+id,120);
 if(action==="heartbeat"){
   let rev;try{rev=checkRevision(b.revision)}catch{throw err("invalid_revision")};const config=normConfig(b.config);
   if(rev<s.revision||rev===s.revision&&s.config!==config)throw err("revision_conflict",409);
   const v=await run(e,"UPDATE sites SET revision=?,config=?,last_seen=? WHERE id=? AND token_hash=? AND revoked=0 AND expires_at>? AND revision=? AND (?=revision OR NOT EXISTS(SELECT 1 FROM proposals WHERE site_id=? AND status='approved'))",rev,config,t(),id,s.token_hash,t(),s.revision,rev,id);
   if(v.meta.changes!==1)throw err("pending_job_or_conflict",409);return json({ok:true,revision:rev});
 }
 if(action==="poll"){const p=await first(e,"SELECT p.id,p.site_id,p.expected_revision,p.config,p.status FROM proposals p JOIN sites s ON s.id=p.site_id WHERE p.site_id=? AND p.status='approved' AND s.token_hash=? AND s.revoked=0 AND s.expires_at>?",id,s.token_hash,t());return json({job:p?{...p,config:JSON.parse(p.config)}:null});}
 if(action==="ack"){
   const p=await first(e,"SELECT * FROM proposals WHERE id=? AND site_id=?",String(b.id||""),id);if(!p)throw err("unknown_job",404);
   if(p.status==="applied"&&b.ok===true&&b.revision===p.expected_revision+1&&normConfig(b.config)===p.config)return json({ok:true,replayed:true});
   if(p.status!=="approved")throw err("job_not_approved",409);
   if(typeof b.ok!=="boolean")throw err("invalid_ack");
   if(b.ok===true&&(b.revision!==p.expected_revision+1||normConfig(b.config)!==p.config))throw err("bad_receipt",409);
   const v=await run(e,"UPDATE proposals SET status=?,updated_at=? WHERE id=? AND site_id=? AND status='approved' AND EXISTS(SELECT 1 FROM sites WHERE id=? AND token_hash=? AND revoked=0 AND expires_at>? AND revision=?)",b.ok?"applied":"failed",t(),p.id,id,id,s.token_hash,t(),p.expected_revision);if(v.meta.changes!==1)throw err("ack_conflict",409);return json({ok:true,status:b.ok?"applied":"failed"});
 }
 throw err("not_found",404);
}
const web={async fetch(r,e){
 try{
   const u=new URL(r.url),p=u.pathname;
   if(p==="/health"&&r.method==="GET")return json({service:"site-control-hub",version:"2.0.0-alpha.1",configured:!!(e.DB&&e.OAUTH_KV&&e.OWNER_GITHUB_ID&&e.GITHUB_CLIENT_ID&&e.GITHUB_CLIENT_SECRET)});
   need(e);
   if(p==="/"||p==="/admin"&&r.method==="GET"){const s=await session(r,e);return s?await dashboard(e):html("<h2>独立网站 · 统一控制</h2><p>仅指定GitHub账户可以登录，没有公共注册。</p><a href='/login'>使用 GitHub 登录</a>");}
   if(p==="/login"&&r.method==="GET")return await startLogin(r,e);
   if(p==="/callback"&&r.method==="GET")return await callback(r,e);
   if(p==="/authorize")return await consent(r,e);
   if(p==="/logout"&&r.method==="POST"){origin(r);const s=await owner(r,e);await run(e,"DELETE FROM sessions WHERE hash=?",s.hash);return redirect("/",secureCookie(S,"",0));}
   if(p.startsWith("/admin/")&&r.method==="POST")return await adminWrite(r,e,p.slice(7));
   const match=p.match(/^\/api\/sites\/([a-z][a-z0-9-]{1,47})\/(heartbeat|poll|ack)$/);if(match)return await siteApi(r,e,match[1],match[2]);
   return json({error:"not_found"},404);
 }catch(x){return json({error:x.status?x.message:"request_failed"},x.status||500);}
}};
function out(obj){return {content:[{type:"text",text:JSON.stringify(obj)}]}}
const mcp={async fetch(r,e,ctx){
 try{
   need(e);if(String(ctx.props?.ownerId)!==String(e.OWNER_GITHUB_ID)||!ctx.props?.agentId)throw err("agent_denied",403);
   const agentId=ctx.props.agentId;await grant(e,agentId,null,"read");await rate(e,"agent:"+agentId,120);
   if(r.headers.has("Origin")&&r.headers.get("Origin")!==new URL(r.url).origin)throw err("origin_denied",403);
   if(Number(r.headers.get("Content-Length")||0)>MAX)throw err("payload_too_large",413);
   const server=new McpServer({name:"Site Control Hub",version:"2.0.0-alpha.1"});
   server.registerTool("list_sites",{description:"List only the websites explicitly authorized by the owner. Configuration is non-sensitive and reported by the site, not a live fetch.",inputSchema:{},annotations:{readOnlyHint:true}},async()=>{try{const g=await grant(e,agentId,null,"read");const result=[];for(const id of g.sites){const row=await first(e,"SELECT * FROM sites WHERE id=?",id);if(row&&!row.revoked&&row.expires_at>t())result.push(cleanSite(row));}return out(result);}catch{return {isError:true,...out({error:"access_denied"})}}});
   server.registerTool("get_site_status",{description:"Read the latest authenticated heartbeat and configuration for one authorized website.",inputSchema:{site_id:z.string().max(48)},annotations:{readOnlyHint:true}},async({site_id})=>{try{await grant(e,agentId,site_id,"read");return out(cleanSite(await activeSite(e,site_id)));}catch{return {isError:true,...out({error:"access_denied_or_unavailable"})}}});
   server.registerTool("list_site_changes",{description:"Read bounded proposal history for one authorized site.",inputSchema:{site_id:z.string().max(48)},annotations:{readOnlyHint:true}},async({site_id})=>{try{await grant(e,agentId,site_id,"read");await activeSite(e,site_id);return out(await rows(e,"SELECT id,site_id,reason,expected_revision,status,created_at,updated_at FROM proposals WHERE site_id=? ORDER BY created_at DESC LIMIT 50",site_id));}catch{return {isError:true,...out({error:"access_denied_or_unavailable"})}}});
   server.registerTool("propose_site_change",{description:"Create a pending configuration proposal; cannot approve, apply, run code, change permissions or access private documents.",inputSchema:{site_id:z.string().max(48),expected_revision:z.number().int().nonnegative(),config:z.object({title:z.string().min(1).max(100),notice:z.string().max(1000),maintenance:z.boolean()}).strict(),reason:z.string().min(1).max(500)},annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:false}},async(a)=>{try{await grant(e,agentId,a.site_id,"propose");return out(await propose(e,a.site_id,"agent:"+agentId,a.expected_revision,a.config,a.reason));}catch(x){return {isError:true,...out({error:x.status?x.message:"proposal_failed"})}}});
   const transport=new WebStandardStreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});await server.connect(transport);
   const bounded=r.method==="POST"?new Request(r.url,{method:r.method,headers:r.headers,body:await limitedText(r)}):r;
   return await transport.handleRequest(bounded);
 }catch(x){return json({error:x.status?x.message:"mcp_failed"},x.status||500);}
}};
export default new OAuthProvider({apiRoute:"/mcp",apiHandler:mcp,defaultHandler:web,authorizeEndpoint:"/authorize",tokenEndpoint:"/token",clientRegistrationEndpoint:"/register",scopesSupported:["control:read","control:propose","offline_access"],accessTokenTTL:900,refreshTokenTTL:2592000});
