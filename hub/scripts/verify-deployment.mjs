// Non-mutating smoke checks. Does not log tokens, fetch arbitrary links, or deploy.
import assert from "node:assert/strict";
import {fileURLToPath} from "node:url";
import {resolve} from "node:path";
export async function verifyDeployment(origin,{allowLoopback=false,fetcher=fetch}={}){
 const u=new URL(origin);
 const loop=allowLoopback&&u.protocol==="http:"&&["localhost","127.0.0.1","[::1]"].includes(u.hostname);
 if((u.protocol!=="https:"&&!loop)||u.username||u.password||u.pathname!=="/"||u.search||u.hash)throw Error("Specify only the HTTPS origin of your authorized Hub.");
 const base=u.origin;
 const req=(path,options={})=>fetcher(base+path,{...options,redirect:"manual",signal:AbortSignal.timeout(15000)});
 const passed=[];
 const health=await req("/health");assert.equal(health.status,200,"health");
 const h=await health.json();assert.equal(h.service,"site-control-hub");assert.equal(h.configured,true);assert.equal(h.ready,true);passed.push("database and KV readiness");
 const a=await req("/admin");assert.equal(a.status,200);assert.match(await a.text(),/GitHub 登录/);
 assert.match(a.headers.get("cache-control")||"",/no-store/);
 assert.equal(a.headers.get("x-frame-options"),"DENY");
 assert.match(a.headers.get("content-security-policy")||"",/frame-ancestors 'none'/);
 passed.push("anonymous owner login and security headers");
 const metadata=await req("/.well-known/oauth-protected-resource/mcp");assert.equal(metadata.status,200);
 const data=await metadata.json();assert.equal(data.resource,base+"/mcp");assert.ok(data.authorization_servers.includes(base));passed.push("OAuth resource discovery");
 // Protocol initialize without a credential must be rejected before any tool is callable.
 const m=await req("/mcp",{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json, text/event-stream"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:"initialize",params:{protocolVersion:"2025-06-18",capabilities:{},clientInfo:{name:"deployment-check",version:"1"}}})});assert.equal(m.status,401);assert.match(m.headers.get("www-authenticate")||"",/Bearer/i);passed.push("unauthenticated MCP rejection");
 return {origin:base,version:h.version,passed,remaining:["real GitHub identity login","authenticated MCP client","independent fixture with persistent data","cloud edge protection and recovery"],scope:"anonymous non-mutating checks only"};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const result=await verifyDeployment(process.argv[2]);console.log(JSON.stringify(result,null,2));}catch(e){console.error("Deployment verification failed:",e.message);process.exitCode=1;}
}
