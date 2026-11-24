import { OAuthProvider } from "@cloudflare/workers-oauth-provider";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import {validateConfig,validateResourceSchema,validateSiteId,checkRevision,authorized,isFresh} from "./core.js";
import {adminView,adminCss} from "./admin-ui.js";

const MAX=32768;
const t=()=>Date.now();
const key=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,"0")).join("");
const sha=async(s)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s))),x=>x.toString(16).padStart(2,"0")).join("");
const esc=(s)=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const head={"Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer","X-Frame-Options":"DENY","Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"};
const json=(obj,status=200)=>Response.json(obj,{status,headers:{...head,...(status===429?{'Retry-After':'60'}:{})}});
const html=(s,status=200)=>new Response('<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Site Control Hub</title><style>body{font:15px system-ui,sans-serif;background:#f6f7f4;color:#202c29;max-width:1000px;margin:0 auto;padding:24px}header{border-bottom:1px solid #cdd5d0;padding:8px 0 18px;margin-bottom:24px}h1{font-size:32px;letter-spacing:-1px}h2{margin-top:30px;font-size:20px}section,article{background:white;border:1px solid #dce2dd;border-radius:12px;padding:18px;margin:12px 0}input,select,button,textarea{font:inherit;padding:10px;border:1px solid #bac7be;border-radius:6px;max-width:100%;box-sizing:border-box}button{background:#245c50;color:white;cursor:pointer}label{display:block;margin:8px 0}form.inline{display:inline-block;margin:4px}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f1f3f0;padding:10px}small{color:#52655c}a{color:#245c50}code{overflow-wrap:anywhere}.row{display:flex;flex-wrap:wrap;gap:10px;align-items:center}.warn{color:#895a16}textarea{width:100%;min-height:100px}'+adminCss+'</style><body><header><small>OWNER WORKSPACE / V2 PREVIEW</small><h1>Site Control Hub</h1><a href="/admin">管理中心</a></header>'+s+'</body></html>',{status,headers:{...head,"Content-Type":"text/html; charset=utf-8"}});
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
function schemaOf(s){return validateResourceSchema(JSON.parse(s.resource_schema||"[]"))}
function normConfig(x,schema=[]){try{return JSON.stringify(validateConfig(x,schema))}catch{throw err("invalid_config")}}
function cleanSite(x,full=false){const config=x.config?JSON.parse(x.config):null;const safeConfig=config&&{title:config.title,notice:config.notice,maintenance:config.maintenance};return {id:x.id,name:x.name,url:x.url,revision:x.revision,resource_schema:schemaOf(x),config:full?config:safeConfig,last_seen:x.last_seen,status:x.revoked?"revoked":x.expires_at<=t()?"expired":isFresh(x.last_seen,t())?"connected":"not_recently_seen"}}
async function activeSite(e,id){try{validateSiteId(id)}catch{throw err("invalid_site_id")}const s=await first(e,"SELECT * FROM sites WHERE id=?",id);if(!s||s.revoked||s.expires_at<=t())throw err("site_unavailable",404);return s;}
async function siteAuth(r,e,id){const s=await activeSite(e,id);const h=r.headers.get("authorization")||"";if(!/^Bearer [a-f0-9]{64}$/.test(h)||await sha(h.slice(7))!==s.token_hash)throw err("site_auth_denied",401);return s;}
async function grant(e,id,site,mode){const row=await first(e,"SELECT * FROM agents WHERE id=?",id);if(!row)throw err("agent_denied",403);const g={...row,sites:JSON.parse(row.sites),writable_sites:JSON.parse(row.writable_sites),can_propose:row.can_propose===1};if(site&&!authorized(g,site,mode,t())||!site&&(g.revoked||g.expires_at<=t()))throw err("agent_denied",403);return g;}
async function propose(e,site,actor,expected,config,reason){
 const s=await activeSite(e,site);try{checkRevision(expected)}catch{throw err("invalid_revision")};if(s.revision!==expected||!s.config)throw err("stale_or_uninitialized",409);
 if(typeof reason!=="string"||!reason.trim()||reason.length>500)throw err("invalid_reason");
 const next=normConfig(config,schemaOf(s));if(next===s.config)throw err("no_change");const id=crypto.randomUUID();
 const guard=actor.startsWith("agent:")?" AND EXISTS(SELECT 1 FROM agents a WHERE a.id=? AND a.revoked=0 AND a.expires_at>? AND a.can_propose=1 AND EXISTS(SELECT 1 FROM json_each(a.sites) WHERE value=sites.id) AND EXISTS(SELECT 1 FROM json_each(a.writable_sites) WHERE value=sites.id))":"";
 const args=actor.startsWith("agent:")?[actor.slice(6),t()]:[];
 const result=await first(e,"INSERT INTO proposals(id,site_id,actor,reason,expected_revision,before_config,config,status,created_at,updated_at) SELECT ?,id,?,?,revision,config,?,'pending',?,? FROM sites WHERE id=? AND revision=? AND revoked=0 AND expires_at>?"+guard+" RETURNING id",id,actor,reason.trim(),next,t(),t(),site,expected,t(),...args);
 if(!result)throw err("stale_revision",409);return {id,site_id:site,status:"pending",expected_revision:expected};
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
   return html("<h2>授权一个AI客户端</h2><p>客户端："+esc(client.clientName||request.clientId)+"</p><p>仅允许选择的网站。可以不选任何网站，先连接客户端；之后在后台单独增加权限。AI可以读取安全配置及提交提案，不能审批或执行修改。授权最长30天，可随时撤销。</p><form method='post' action='/authorize'><input type='hidden' name='nonce' value='"+nonce+"'>"+sites.map(x=>"<label><input type='checkbox' name='site' value='"+esc(x.id)+"'> 读取 "+esc(x.name)+" / "+esc(x.id)+"</label><label><input type='checkbox' name='write_site' value='"+esc(x.id)+"'> 允许对该站提交提案（仍需选中读取权限）</label>").join("")+"<label><input type='checkbox' name='propose' value='yes'>允许此客户端获得提出修改的 OAuth 范围（仍需本人审批）</label><button>确认授权</button></form><p><a href='/admin'>取消</a></p>");
 }
 if(r.method!=="POST"||!s)throw err("login_required",401);
 const f=await form(r),nonce=String(f.get("nonce")||"");if(!/^[a-f0-9]{64}$/.test(nonce))throw err("bad_consent");
 const flow=await first(e,"DELETE FROM consent_flows WHERE hash=? AND session_hash=? AND expires_at>? RETURNING request_json",await sha(nonce),s.hash,t());if(!flow)throw err("consent_expired",403);
 const request=JSON.parse(flow.request_json),ids=[...new Set(f.getAll("site").map(String))];if(ids.length>100)throw err("too_many_sites");
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
async function dashboard(e,r){
 const [siteRows,props,agents,audit,metrics]=await Promise.all([
 rows(e,"SELECT * FROM sites ORDER BY created_at DESC LIMIT 100"),
 rows(e,"SELECT * FROM proposals ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,created_at DESC LIMIT 100"),
 rows(e,"SELECT id,label,sites,writable_sites,can_propose,expires_at,revoked FROM agents ORDER BY expires_at DESC LIMIT 100"),
 rows(e,"SELECT * FROM audit ORDER BY id DESC LIMIT 50"),
 first(e,"SELECT (SELECT count(*) FROM sites) AS site_count,(SELECT count(*) FROM sites WHERE revoked=0 AND expires_at>? AND last_seen>=? AND last_seen<=?) AS connected,(SELECT count(*) FROM proposals WHERE status='pending') AS pending,(SELECT count(*) FROM agents WHERE revoked=0 AND expires_at>?) AS active_agents",t(),t()-900000,t(),t())
 ]);
 const u=new URL(r.url);
 return html(adminView({page:u.searchParams.get("view")||"overview",query:(u.searchParams.get("q")||"").slice(0,100),sites:siteRows.map(x=>({...cleanSite(x,true),expires_at:x.expires_at})),proposals:props,agents,audit,metrics}));
}
async function adminWrite(r,e,action){
 const admin=await owner(r,e);const f=await form(r),id=String(f.get("id")||"");await rate(e,"owner:"+admin.owner_id,120);
 if(action==="register"||action==="rotate"){
   validateSiteId(id);const token=key(),hash=await sha(token),expiry=t()+7776000000;
   if(action==="register"){const name=String(f.get("name")||"").trim();if(!name||name.length>100)throw err("invalid_name");const url=secureUrl(String(f.get("url")||""));let schema;try{schema=validateResourceSchema(JSON.parse(String(f.get("resource_schema")||"[]")))}catch{throw err("invalid_resource_schema")};if(schema.length&&f.get("resource_safe")!=="yes")throw err("resource_confirmation_required");await run(e,"INSERT INTO sites(id,name,url,token_hash,expires_at,created_at,resource_schema) VALUES(?,?,?,?,?,?,?)",id,name,url,hash,expiry,t(),JSON.stringify(schema));}
   else{const v=await first(e,"UPDATE sites SET token_hash=?,expires_at=?,revoked=0,last_seen=NULL WHERE id=? RETURNING id",hash,expiry,id);if(!v)throw err("not_found",404);}
   return html("<h2>网站连接令牌 · 仅此一次</h2><p>将以下值放进网站服务端 Secret，切勿放到浏览器或 Git。</p><pre>"+esc("SITE_ID="+id+"\nHUB_URL="+new URL(r.url).origin+"\nSITE_TOKEN="+token)+"</pre><p>90天有效。关闭页面后不能重新读取，丢失可轮换。</p><a href='/admin'>返回</a>");
 }
 if(action==="revoke-site"){
   const siteId=validateSiteId(id),now=t();
   await e.DB.batch([
     q(e,"UPDATE proposals SET status='rejected',updated_at=? WHERE site_id=? AND status='pending'",now,siteId),
     q(e,"UPDATE proposals SET status='failed',updated_at=? WHERE site_id=? AND status='approved'",now,siteId),
     q(e,"UPDATE agents SET sites=(SELECT json_group_array(value) FROM json_each(agents.sites) WHERE value<>?),writable_sites=(SELECT json_group_array(value) FROM json_each(agents.writable_sites) WHERE value<>?) WHERE EXISTS(SELECT 1 FROM json_each(agents.sites) WHERE value=?) OR EXISTS(SELECT 1 FROM json_each(agents.writable_sites) WHERE value=?)",siteId,siteId,siteId,siteId),
     q(e,"UPDATE sites SET revoked=1,last_seen=NULL WHERE id=?",siteId)
   ]);
 }
 else if(action==="cleanup"){const now=t();await e.DB.batch([q(e,"DELETE FROM sessions WHERE expires_at<=?",now),q(e,"DELETE FROM login_flows WHERE expires_at<=?",now),q(e,"DELETE FROM consent_flows WHERE expires_at<=?",now),q(e,"DELETE FROM rate_limits WHERE window_start<?",Math.floor(now/60000)-1440),q(e,"INSERT INTO audit(action,subject,at) VALUES(?,?,?)","maintenance:cleanup","expired_ephemeral_state",now)]);}
 else if(action==="revoke-agent"){await run(e,"UPDATE agents SET revoked=1 WHERE id=?",id);}
 else if(action==="update-agent"){
   const a=await first(e,"SELECT * FROM agents WHERE id=? AND revoked=0 AND expires_at>?",id,t());if(!a)throw err("grant_unavailable",404);
   const ids=[...new Set(f.getAll("site").map(String))];if(ids.length>100)throw err("too_many_sites");
   for(const site of ids)await activeSite(e,site);
   const writes=a.can_propose?[...new Set(f.getAll("write_site").map(String))].filter(site=>ids.includes(site)):[];
   const v=await first(e,"UPDATE agents SET sites=?,writable_sites=? WHERE id=? AND revoked=0 AND expires_at>? RETURNING id",JSON.stringify(ids),JSON.stringify(writes),id,t());if(!v)throw err("grant_unavailable",409);
 }
 else if(action==="propose"){let c;try{c=JSON.parse(String(f.get("config")))}catch{throw err("invalid_json")}await propose(e,id,"owner",Number(f.get("revision")),c,String(f.get("reason")||""));}
 else if(action==="approve"){const v=await first(e,"UPDATE proposals SET status='approved',updated_at=? WHERE id=? AND status='pending' AND EXISTS(SELECT 1 FROM sites s WHERE s.id=proposals.site_id AND s.revision=proposals.expected_revision AND s.revoked=0 AND s.expires_at>?) AND NOT EXISTS(SELECT 1 FROM proposals p WHERE p.site_id=proposals.site_id AND p.status='approved') RETURNING id",t(),id,t());if(!v)throw err("stale_or_conflicting_approval",409);}
 else if(action==="reject"){const v=await first(e,"UPDATE proposals SET status='rejected',updated_at=? WHERE id=? AND status='pending' RETURNING id",t(),id);if(!v)throw err("not_pending",409);}
 else if(action==="rollback"){const p=await first(e,"SELECT * FROM proposals WHERE id=? AND status='applied'",id);if(!p)throw err("not_found",404);const s=await activeSite(e,p.site_id);await propose(e,s.id,"owner",s.revision,JSON.parse(p.before_config),"Restore previous values from "+id);}
 else throw err("unknown_action",404);
 return redirect("/admin");
}
async function siteApi(r,e,id,action){
 if(r.method!=="POST")throw err("method_denied",405);
 const s=await siteAuth(r,e,id),b=await body(r);await rate(e,"site:"+id,120);
 if(action==="heartbeat"){
   let rev;try{rev=checkRevision(b.revision)}catch{throw err("invalid_revision")};const schema=schemaOf(s);if(schema.length&&JSON.stringify(b.resource_schema)!==JSON.stringify(schema))throw err("resource_schema_mismatch",409);const config=normConfig(b.config,schema);
   if(rev<s.revision||rev===s.revision&&s.config!==config)throw err("revision_conflict",409);
   const v=await first(e,"UPDATE sites SET revision=?,config=?,last_seen=? WHERE id=? AND token_hash=? AND revoked=0 AND expires_at>? AND revision=? AND (?=revision OR NOT EXISTS(SELECT 1 FROM proposals WHERE site_id=? AND status='approved')) RETURNING id",rev,config,t(),id,s.token_hash,t(),s.revision,rev,id);
   if(!v)throw err("pending_job_or_conflict",409);return json({ok:true,revision:rev});
 }
 if(action==="poll"){const p=await first(e,"SELECT p.id,p.site_id,p.expected_revision,p.config,p.status FROM proposals p JOIN sites s ON s.id=p.site_id WHERE p.site_id=? AND p.status='approved' AND s.token_hash=? AND s.revoked=0 AND s.expires_at>?",id,s.token_hash,t());return json({resource_schema:schemaOf(s),job:p?{...p,config:JSON.parse(p.config)}:null});}
 if(action==="ack"){
   const p=await first(e,"SELECT * FROM proposals WHERE id=? AND site_id=?",String(b.id||""),id);if(!p)throw err("unknown_job",404);
   if(p.status==="applied"&&b.ok===true&&b.revision===p.expected_revision+1&&normConfig(b.config,schemaOf(s))===p.config)return json({ok:true,replayed:true});
   if(p.status!=="approved")throw err("job_not_approved",409);
   if(typeof b.ok!=="boolean")throw err("invalid_ack");
   if(b.ok===true&&(b.revision!==p.expected_revision+1||normConfig(b.config,schemaOf(s))!==p.config))throw err("bad_receipt",409);
   const v=await first(e,"UPDATE proposals SET status=?,updated_at=? WHERE id=? AND site_id=? AND status='approved' AND EXISTS(SELECT 1 FROM sites WHERE id=? AND token_hash=? AND revoked=0 AND expires_at>? AND revision=?) RETURNING id",b.ok?"applied":"failed",t(),p.id,id,id,s.token_hash,t(),p.expected_revision);if(!v)throw err("ack_conflict",409);return json({ok:true,status:b.ok?"applied":"failed"});
 }
 throw err("not_found",404);
}
const web={async fetch(r,e){
 try{
   const u=new URL(r.url),p=u.pathname;
   if(p==="/health"&&r.method==="GET"){
      const configured=!!(e.DB&&e.OAUTH_KV&&e.OWNER_GITHUB_ID&&e.GITHUB_CLIENT_ID&&e.GITHUB_CLIENT_SECRET);
      let ready=false;
      if(configured){try{
        await Promise.all([first(e,"SELECT resource_schema FROM sites LIMIT 1"),first(e,"SELECT hash FROM sessions LIMIT 1"),first(e,"SELECT principal FROM rate_limits LIMIT 1"),first(e,"SELECT writable_sites FROM agents LIMIT 1"),first(e,"SELECT id FROM proposals LIMIT 1"),first(e,"SELECT id FROM audit LIMIT 1"),e.OAUTH_KV.get("__site_control_readiness__")]);
        ready=true;
      }catch{}}
      return json({service:"site-control-hub",version:"2.0.0-alpha.1",configured,ready},ready?200:503);
   }
   need(e);
   if(p==="/"||p==="/admin"&&r.method==="GET"){const s=await session(r,e);return s?await dashboard(e,r):html("<h2>独立网站 · 统一控制</h2><p>仅指定GitHub账户可以登录，没有公共注册。</p><a href='/login'>使用 GitHub 登录</a>");}
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
   const agentId=ctx.props.agentId;const scopes=ctx.auth?.scope;if(!Array.isArray(scopes)||!scopes.includes("control:read"))throw err("read_scope_required",403);await grant(e,agentId,null,"read");await rate(e,"agent:"+agentId,120);
   if(r.headers.has("Origin")&&r.headers.get("Origin")!==new URL(r.url).origin)throw err("origin_denied",403);
   if(Number(r.headers.get("Content-Length")||0)>MAX)throw err("payload_too_large",413);
   const server=new McpServer({name:"Site Control Hub",version:"2.0.0-alpha.1"});
   server.registerTool("list_sites",{description:"List only the websites explicitly authorized by the owner. Configuration is non-sensitive and reported by the site, not a live fetch.",inputSchema:{},annotations:{readOnlyHint:true}},async()=>{try{const g=await grant(e,agentId,null,"read");const result=[];for(const id of g.sites){const row=await first(e,"SELECT * FROM sites WHERE id=?",id);if(row&&!row.revoked&&row.expires_at>t())result.push(cleanSite(row));}return out(result);}catch{return {isError:true,...out({error:"access_denied"})}}});
   server.registerTool("get_site_status",{description:"Read the latest authenticated heartbeat and configuration for one authorized website.",inputSchema:{site_id:z.string().max(48)},annotations:{readOnlyHint:true}},async({site_id})=>{try{await grant(e,agentId,site_id,"read");return out(cleanSite(await activeSite(e,site_id)));}catch{return {isError:true,...out({error:"access_denied_or_unavailable"})}}});
   server.registerTool("list_site_changes",{description:"Read bounded proposal history for one authorized site.",inputSchema:{site_id:z.string().max(48)},annotations:{readOnlyHint:true}},async({site_id})=>{try{await grant(e,agentId,site_id,"read");await activeSite(e,site_id);return out(await rows(e,"SELECT id,site_id,reason,expected_revision,status,created_at,updated_at FROM proposals WHERE site_id=? ORDER BY created_at DESC LIMIT 50",site_id));}catch{return {isError:true,...out({error:"access_denied_or_unavailable"})}}});
   server.registerTool("propose_site_change",{description:"Create a pending configuration proposal; cannot approve, apply, run code, change permissions or access private documents.",inputSchema:{site_id:z.string().max(48),expected_revision:z.number().int().nonnegative(),config:z.object({title:z.string().min(1).max(100),notice:z.string().max(1000),maintenance:z.boolean()}).strict(),reason:z.string().min(1).max(500)},annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:false}},async(a)=>{try{if(!scopes.includes("control:propose"))throw err("write_scope_required",403);await grant(e,agentId,a.site_id,"propose");const s=await activeSite(e,a.site_id),old=s.config?JSON.parse(s.config):null;const next=schemaOf(s).length&&old?{...a.config,resources:old.resources}:a.config;return out(await propose(e,a.site_id,"agent:"+agentId,a.expected_revision,next,a.reason));}catch(x){return {isError:true,...out({error:x.status?x.message:"proposal_failed"})}}});

   server.registerTool("list_site_capabilities",{description:"Discover the immutable, owner-approved public resource collection schemas for an authorized site.",inputSchema:{site_id:z.string().max(48)},annotations:{readOnlyHint:true}},async({site_id})=>{try{await grant(e,agentId,site_id,"read");const s=await activeSite(e,site_id);return out({site_id,revision:s.revision,resources:schemaOf(s),initialized:!!s.config});}catch{return {isError:true,...out({error:"access_denied_or_unavailable"})}}});
   server.registerTool("read_site_resource",{description:"Read one approved public resource collection from the last reported snapshot, not a live search.",inputSchema:{site_id:z.string().max(48),resource_id:z.string().max(32)},annotations:{readOnlyHint:true}},async({site_id,resource_id})=>{try{await grant(e,agentId,site_id,"read");const s=await activeSite(e,site_id);if(!s.config||!schemaOf(s).some(x=>x.id===resource_id))throw err("resource_unavailable",404);return out({site_id,resource_id,revision:s.revision,records:JSON.parse(s.config).resources[resource_id]});}catch{return {isError:true,...out({error:"access_denied_or_unavailable"})}}});
   server.registerTool("propose_site_resource_change",{description:"Propose replacing one declared, non-sensitive resource collection with validated JSON records. The owner must approve and the website must confirm persistent application.",inputSchema:{site_id:z.string().max(48),resource_id:z.string().max(32),expected_revision:z.number().int().nonnegative(),records_json:z.string().max(8000),reason:z.string().min(1).max(500)},annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:false}},async(a)=>{try{if(!scopes.includes("control:propose"))throw err("write_scope_required",403);await grant(e,agentId,a.site_id,"propose");const s=await activeSite(e,a.site_id);if(!s.config||!schemaOf(s).some(x=>x.id===a.resource_id))throw err("resource_unavailable",404);let data;try{data=JSON.parse(a.records_json)}catch{throw err("invalid_json")};const config=JSON.parse(s.config);config.resources[a.resource_id]=data;return out(await propose(e,a.site_id,"agent:"+agentId,a.expected_revision,config,a.reason));}catch(x){return {isError:true,...out({error:x.status?x.message:"proposal_failed"})}}});
   const transport=new WebStandardStreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});await server.connect(transport);
   const bounded=r.method==="POST"?new Request(r.url,{method:r.method,headers:r.headers,body:await limitedText(r)}):r;
   return await transport.handleRequest(bounded);
 }catch(x){return json({error:x.status?x.message:"mcp_failed"},x.status||500);}
}};
// Canonical resource is deployment configuration, never derived from an untrusted Host header.
export default {async fetch(r,e,ctx){
 let base;
 try{
   base=new URL(e.HUB_ORIGIN);
   if(base.username||base.password||base.pathname!=="/"||base.search||base.hash||
      !(base.protocol==="https:"||base.protocol==="http:"&&["127.0.0.1","localhost","[::1]"].includes(base.hostname)))throw Error("invalid_origin");
 }catch{return json({error:"hub_origin_not_configured"},503);}
 if(new URL(r.url).origin!==base.origin)return json({error:"wrong_hub_origin"},421);
 // Global bounded budgets protect the unauthenticated OAuth entry points without storing IP addresses.
 // A platform edge rate limit is still required to protect D1 usage before requests reach this code.
 const path=new URL(r.url).pathname;
 const budgets={"/register":20,"/token":120,"/authorize":90,"/login":30,"/callback":60};
 if(Object.hasOwn(budgets,path)){
   try{
     need(e);
     if(r.method==="POST"){
       const text=await limitedText(r);
       r=new Request(r.url,{method:r.method,headers:r.headers,body:text});
     }
     await rate(e,"public:"+path,budgets[path]);
   }catch(x){return json({error:x.status?x.message:"public_gate_failed"},x.status||503);}
 }
 const provider=new OAuthProvider({apiRoute:"/mcp",apiHandler:mcp,defaultHandler:web,authorizeEndpoint:"/authorize",tokenEndpoint:"/token",clientRegistrationEndpoint:"/register",scopesSupported:["control:read","control:propose","offline_access"],requiredScopes:["control:read"],resourceMetadata:{resource:base.origin+"/mcp",authorization_servers:[base.origin],resource_name:"Site Control Hub"},accessTokenTTL:900,refreshTokenTTL:2592000});
 return provider.fetch(r,e,ctx);
}};
