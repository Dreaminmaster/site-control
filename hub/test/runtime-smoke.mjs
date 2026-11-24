import assert from "node:assert/strict";
import {spawn,execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {setTimeout as pause} from "node:timers/promises";
const wrangler="./node_modules/.bin/wrangler",base="http://127.0.0.1:8790",session="c".repeat(64);
const hash=createHash("sha256").update(session).digest("hex");
const sql="INSERT OR REPLACE INTO sessions(hash,owner_id,expires_at) VALUES('"+hash+"','fixture-owner',"+(Date.now()+600000)+");";
execFileSync(wrangler,["d1","execute","DB","--local","--command",sql],{stdio:"pipe"});
const p=spawn(wrangler,["dev","--local","--ip","127.0.0.1","--port","8790","--var","HUB_ORIGIN:"+base,"--var","OWNER_GITHUB_ID:fixture-owner","--var","GITHUB_CLIENT_ID:fixture-client","--var","GITHUB_CLIENT_SECRET:fixture-secret"],{stdio:["ignore","pipe","pipe"],env:{...process.env,CI:"true"}});
let logs="";p.stdout.on("data",x=>{logs=(logs+x).slice(-10000)});p.stderr.on("data",x=>{logs=(logs+x).slice(-10000)});
const cookie="__Host-sc_session="+session;
async function req(path,opts={}){return fetch(base+path,{redirect:"manual",...opts});}
async function post(path,fields,owner=true,origin=true){return req(path,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded",...(owner?{Cookie:cookie}:{}),...(origin?{Origin:base}:{})},body:new URLSearchParams(fields)});}
async function site(id,token,action,data){return req("/api/sites/"+id+"/"+action,{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify(data)});}
const check=async(response,status,label)=>{if(response.status!==status){const detail=await response.clone().text();assert.equal(response.status,status,label+" · "+detail.slice(0,300));}return response};
function findProposal(html,action){const m=html.match(new RegExp("action='/admin/"+action+"'><input type='hidden' name='id' value='([^']+)'"));assert.ok(m,"missing "+action+" form");return m[1];}
try{
 let ready=false;for(let i=0;i<60;i++){try{const r=await req("/health");if(r.ok&&(await r.json()).configured){ready=true;break;}}catch{}await pause(500);}
 assert.ok(ready,"Worker did not become ready");
 assert.match(await (await req("/admin")).text(),/GitHub 登录/);
 await check(await post("/admin/register",{id:"smoke-a",name:"Fixture A",url:"https://example.invalid/"},false),401,"unauthorized owner write");
 await check(await post("/admin/register",{id:"smoke-a",name:"Fixture A",url:"https://example.invalid/"},true,false),403,"CSRF origin rejection");
 const regA=await check(await post("/admin/register",{id:"smoke-a",name:"Fixture A",url:"https://example.invalid/"}),200,"register site A");
 const tokenA=(await regA.text()).match(/SITE_TOKEN=([a-f0-9]{64})/)?.[1];assert.ok(tokenA);
 const regB=await check(await post("/admin/register",{id:"smoke-b",name:"Fixture B",url:"https://example.invalid/"}),200,"register site B");
 const tokenB=(await regB.text()).match(/SITE_TOKEN=([a-f0-9]{64})/)?.[1];assert.ok(tokenB);assert.notEqual(tokenA,tokenB);
 const config={title:"Initial",notice:"Synthetic fixture",maintenance:false},next={...config,title:"Approved change"};
 await check(await site("smoke-b",tokenA,"poll",{}),401,"cross-site token denial");
 await check(await site("smoke-a",tokenA,"heartbeat",{revision:0,config}),200,"first heartbeat");
 await check(await site("smoke-a",tokenA,"heartbeat",{revision:-1,config}),400,"invalid revision");
 await check(await site("smoke-a",tokenA,"heartbeat",{revision:0,config:{...config,extra:"unsupported"}}),400,"invalid configuration");
 await check(await site("smoke-a",tokenA,"heartbeat",null),400,"invalid JSON object");
 await check(await post("/admin/propose",{id:"smoke-a",revision:"0",reason:"Synthetic change",config:JSON.stringify(next)}),303,"owner proposal");
 assert.equal((await (await site("smoke-a",tokenA,"poll",{})).json()).job,null,"pending proposal cannot be fetched");
 const dashboard=async()=>await (await req("/admin?view=changes",{headers:{Cookie:cookie}})).text();
 let html=await dashboard(),id=findProposal(html,"approve");
 assert.match(await (await req("/admin?view=sites&q=smoke-a",{headers:{Cookie:cookie}})).text(),/Fixture A/);
 assert.match(await (await req("/admin?view=agents",{headers:{Cookie:cookie}})).text(),/MCP 连接入口/);
 await check(await post("/admin/approve",{id}),303,"approve proposal");
 const job=(await (await site("smoke-a",tokenA,"poll",{})).json()).job;assert.equal(job.id,id);assert.equal(job.expected_revision,0);
 await check(await site("smoke-a",tokenA,"ack",{id,ok:true,revision:2,config:next}),409,"wrong receipt revision");
 await check(await site("smoke-a",tokenA,"ack",{id,ok:true,revision:1,config:next}),200,"valid receipt");
 assert.equal((await (await site("smoke-a",tokenA,"ack",{id,ok:true,revision:1,config:next})).json()).replayed,true);
 await check(await site("smoke-a",tokenA,"heartbeat",{revision:0,config}),409,"stale heartbeat");
 html=await dashboard();assert.match(html,/Approved change/);assert.match(html,/已确认执行/);
 await check(await post("/admin/rollback",{id}),303,"rollback creates proposal");
 html=await dashboard();const rollbackId=findProposal(html,"approve");assert.notEqual(rollbackId,id);
 await check(await post("/admin/approve",{id:rollbackId}),303,"approve rollback");
 const rollback=(await (await site("smoke-a",tokenA,"poll",{})).json()).job;assert.deepEqual(rollback.config,config);
 await check(await site("smoke-a",tokenA,"ack",{id:rollbackId,ok:true,revision:2,config}),200,"rollback receipt");
 await check(await post("/admin/revoke-site",{id:"smoke-a"}),303,"revoke site");
 await check(await site("smoke-a",tokenA,"poll",{}),404,"revoked token rejected");
 await check(await site("smoke-b",tokenB,"heartbeat",{revision:0,config}),200,"other site unaffected");
 await check(await post("/admin/cleanup",{}),303,"owner-only ephemeral cleanup");
 const mcp=await req("/mcp",{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json, text/event-stream"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:"initialize",params:{protocolVersion:"2025-06-18",capabilities:{},clientInfo:{name:"fixture",version:"1"}}})});
 assert.equal(mcp.status,401,"unauthenticated MCP denied");
 const metadata=await check(await req("/.well-known/oauth-protected-resource/mcp"),200,"resource discovery");assert.equal((await metadata.json()).resource,base+"/mcp");

 // Real OAuth provider issuance using synthetic owner session; no upstream GitHub login.
 const redirectUri="http://127.0.0.1:8791/callback",verifier="x".repeat(64),challenge=createHash("sha256").update(verifier).digest("base64url");
 const reg=await req("/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({client_name:"Local smoke test",redirect_uris:[redirectUri],grant_types:["authorization_code","refresh_token"],response_types:["code"],token_endpoint_auth_method:"none"})});
 assert.ok(reg.status===201||reg.status===200,"dynamic client registration: "+reg.status+" "+(reg.status>=400?await reg.text():""));
 const client=await reg.json();assert.ok(client.client_id);
 const params=new URLSearchParams({client_id:client.client_id,redirect_uri:redirectUri,response_type:"code",scope:"control:read control:propose",state:"local-smoke",code_challenge:challenge,code_challenge_method:"S256",resource:base+"/mcp"});
 const consent=await check(await req("/authorize?"+params,{headers:{Cookie:cookie}}),200,"OAuth consent");
 const nonce=(await consent.text()).match(/name='nonce' value='([a-f0-9]{64})'/)?.[1];assert.ok(nonce,"consent nonce");
 const approved=await check(await post("/authorize",{nonce,site:"smoke-b",write_site:"smoke-b",propose:"yes"}),303,"OAuth grant");
 const location=new URL(approved.headers.get("Location"));assert.equal(location.origin,new URL(redirectUri).origin);assert.equal(location.searchParams.get("state"),"local-smoke");
 const code=location.searchParams.get("code");assert.ok(code,"authorization code");
 const tokens=await check(await req("/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"authorization_code",client_id:client.client_id,redirect_uri:redirectUri,code,code_verifier:verifier,resource:base+"/mcp"})}),200,"OAuth token exchange");
 const credential=await tokens.json();assert.ok(credential.access_token);
 const rpc=async(method,params)=>{const r=await req("/mcp",{method:"POST",headers:{Authorization:"Bearer "+credential.access_token,"Content-Type":"application/json",Accept:"application/json, text/event-stream","MCP-Protocol-Version":"2025-06-18"},body:JSON.stringify({jsonrpc:"2.0",id:1,method,params})});assert.equal(r.status,200,"MCP "+method);return r.json();};
 const ls=await rpc("tools/call",{name:"list_sites",arguments:{}});assert.ok(!ls.error&&!ls.result?.isError,"list authorized sites");assert.deepEqual(JSON.parse(ls.result.content[0].text).map(x=>x.id),["smoke-b"]);
 const denied=await rpc("tools/call",{name:"get_site_status",arguments:{site_id:"smoke-a"}});assert.equal(denied.result.isError,true,"OAuth site isolation");
 const proposal=await rpc("tools/call",{name:"propose_site_change",arguments:{site_id:"smoke-b",expected_revision:0,reason:"OAuth fixture proposal",config:{...config,title:"MCP proposed"}}});assert.equal(JSON.parse(proposal.result.content[0].text).status,"pending");
 const agentPage=await (await req("/admin?view=agents",{headers:{Cookie:cookie}})).text();const agentId=findProposal(agentPage,"revoke-agent");
 await check(await post("/admin/revoke-agent",{id:agentId}),303,"revoke OAuth grant");
 const deniedAfter=await req("/mcp",{method:"POST",headers:{Authorization:"Bearer "+credential.access_token,"Content-Type":"application/json",Accept:"application/json, text/event-stream"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:"tools/list"})});assert.ok([401,403].includes(deniedAfter.status),"revoked OAuth grant denied");
 console.log("PASS: local OAuth dynamic registration, PKCE, consent, token exchange, actual MCP tool calls, scoped access and revocation");

 console.log("PASS: local Worker HTTP onboarding, CSRF, tenant isolation, approved-only polling, CAS receipts, replay, rollback, revocation, and unauthenticated MCP rejection");
}catch(e){console.error("Runtime smoke failed:",e.message);console.error(logs.replace(/Bearer [a-f0-9]{64}/g,"Bearer [redacted]"));process.exitCode=1;}
finally{p.kill("SIGTERM");}
