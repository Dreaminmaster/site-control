import assert from "node:assert/strict";
import {spawn,execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {setTimeout as pause} from "node:timers/promises";
const wrangler="./node_modules/.bin/wrangler",base="http://127.0.0.1:8790",session="c".repeat(64);
const hash=createHash("sha256").update(session).digest("hex");
const sql="INSERT OR REPLACE INTO sessions(hash,owner_id,expires_at) VALUES('"+hash+"','fixture-owner',"+(Date.now()+600000)+");";
execFileSync(wrangler,["d1","execute","DB","--local","--command",sql],{stdio:"pipe"});
const p=spawn(wrangler,["dev","--local","--ip","127.0.0.1","--port","8790","--var","OWNER_GITHUB_ID:fixture-owner","--var","GITHUB_CLIENT_ID:fixture-client","--var","GITHUB_CLIENT_SECRET:fixture-secret"],{stdio:["ignore","pipe","pipe"],env:{...process.env,CI:"true"}});
let logs="";p.stdout.on("data",x=>{logs=(logs+x).slice(-10000)});p.stderr.on("data",x=>{logs=(logs+x).slice(-10000)});
const cookie="__Host-sc_session="+session;
async function req(path,opts={}){return fetch(base+path,{redirect:"manual",...opts});}
async function post(path,fields,owner=true,origin=true){return req(path,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded",...(owner?{Cookie:cookie}:{}),...(origin?{Origin:base}:{})},body:new URLSearchParams(fields)});}
async function site(id,token,action,data){return req("/api/sites/"+id+"/"+action,{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify(data)});}
const check=async(response,status,label)=>{assert.equal(response.status,status,label);return response};
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
 const dashboard=async()=>await (await req("/admin",{headers:{Cookie:cookie}})).text();
 let html=await dashboard(),id=findProposal(html,"approve");
 await check(await post("/admin/approve",{id}),303,"approve proposal");
 const job=(await (await site("smoke-a",tokenA,"poll",{})).json()).job;assert.equal(job.id,id);assert.equal(job.expected_revision,0);
 await check(await site("smoke-a",tokenA,"ack",{id,ok:true,revision:2,config:next}),409,"wrong receipt revision");
 await check(await site("smoke-a",tokenA,"ack",{id,ok:true,revision:1,config:next}),200,"valid receipt");
 assert.equal((await (await site("smoke-a",tokenA,"ack",{id,ok:true,revision:1,config:next})).json()).replayed,true);
 await check(await site("smoke-a",tokenA,"heartbeat",{revision:0,config}),409,"stale heartbeat");
 html=await dashboard();assert.match(html,/Approved change/);assert.match(html,/applied/);
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
 console.log("PASS: local Worker HTTP onboarding, CSRF, tenant isolation, approved-only polling, CAS receipts, replay, rollback, revocation, and unauthenticated MCP rejection");
}catch(e){console.error("Runtime smoke failed:",e.message);console.error(logs.replace(/Bearer [a-f0-9]{64}/g,"Bearer [redacted]"));process.exitCode=1;}
finally{p.kill("SIGTERM");}
