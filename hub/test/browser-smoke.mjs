// Real Chromium/CDP test against a local Worker, using exclusively synthetic test state.
import assert from "node:assert/strict";
import {spawn,execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {setTimeout as pause} from "node:timers/promises";
const base="http://127.0.0.1:8792",debug="http://127.0.0.1:9223",session="e".repeat(64);
const hash=createHash("sha256").update(session).digest("hex");
execFileSync("./node_modules/.bin/wrangler",["d1","execute","DB","--local","--command","INSERT OR REPLACE INTO sessions(hash,owner_id,expires_at) VALUES('"+hash+"','fixture-owner',"+(Date.now()+600000)+");"],{stdio:"pipe"});
const dir=mkdtempSync(join(tmpdir(),"sc-browser-"));
const worker=spawn("./node_modules/.bin/wrangler",["dev","--local","--ip","127.0.0.1","--port","8792","--var","HUB_ORIGIN:"+base,"--var","OWNER_GITHUB_ID:fixture-owner","--var","GITHUB_CLIENT_ID:fixture-client","--var","GITHUB_CLIENT_SECRET:fixture-secret"],{stdio:"ignore",env:{...process.env,CI:"true"}});
const chrome=spawn(process.env.CHROME_BIN||"google-chrome",["--headless","--no-sandbox","--disable-dev-shm-usage","--remote-debugging-port=9223","--user-data-dir="+dir,"--no-first-run","about:blank"],{stdio:"ignore"});
let ws,serial=0;
const pending=new Map();
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;const timer=setTimeout(()=>{pending.delete(id);reject(Error("CDP timeout: "+method))},10000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});
const evaluate=async(expression)=>(await call("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true})).result.value;
async function until(fn,label){for(let i=0;i<60;i++){try{const value=await fn();if(value)return value}catch{}await pause(500)}throw Error(label)}
try{
 await until(async()=>{const r=await fetch(base+"/health");return r.ok&&(await r.json()).configured},"local Worker unavailable");
 const target=await until(async()=>(await (await fetch(debug+"/json/list")).json()).find(x=>x.type==="page"),"Chrome unavailable");
 ws=new WebSocket(target.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{ws.addEventListener("open",resolve,{once:true});ws.addEventListener("error",reject,{once:true})});
 ws.addEventListener("message",e=>{const x=JSON.parse(e.data);const p=pending.get(x.id);if(p){clearTimeout(p.timer);pending.delete(x.id);x.error?p.reject(Error(x.error.message)):p.resolve(x.result)}});
 await call("Page.enable");await call("Network.enable");
 const cookie=await call("Network.setCookie",{name:"__Host-sc_session",value:session,url:base+"/",path:"/",secure:true,httpOnly:true,sameSite:"Lax"});assert.equal(cookie.success,true);
 mkdirSync("browser-evidence",{recursive:true});
 for(const viewport of [{name:"desktop",width:1440,height:900,mobile:false},{name:"mobile",width:390,height:844,mobile:true}]){
   await call("Emulation.setDeviceMetricsOverride",{width:viewport.width,height:viewport.height,deviceScaleFactor:1,mobile:viewport.mobile});
   for(const view of ["overview","sites","changes","agents","audit"]){
     await call("Page.navigate",{url:base+"/admin?view="+view});
     await until(()=>evaluate("document.readyState==='complete' && location.search==="+JSON.stringify("?view="+view)+" && !!document.querySelector('.workspace main')"),"owner page did not render: "+view);
     const layout=await evaluate("({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,nav:!!document.querySelector('nav a[aria-current=page]'),title:document.querySelector('main h1')?.textContent})");
     assert.ok(layout.nav&&layout.title,view+" navigation");
     assert.ok(layout.scroll<=layout.width+2,viewport.name+" "+view+" horizontal overflow "+JSON.stringify(layout));
     const shot=await call("Page.captureScreenshot",{format:"png",captureBeyondViewport:false});
     writeFileSync("browser-evidence/"+viewport.name+"-"+view+".png",Buffer.from(shot.data,"base64"));
   }
 }
 // Real navigation and native search form submission, not a mocked rendering.
 await call("Page.navigate",{url:base+"/admin?view=sites"});
 await until(()=>evaluate("!!document.querySelector('.search input[name=q]')"),"search form unavailable");
 await evaluate("document.querySelector('.search input[name=q]').value='Independent fixture';document.querySelector('.search').requestSubmit();true");
 await until(()=>evaluate("new URL(location.href).searchParams.get('q')==='Independent fixture' && document.body.innerText.includes('Independent fixture')"),"site search failed");
 const matches=await evaluate("Array.from(document.querySelectorAll('article.record h3')).map(x=>x.textContent)");
 assert.deepEqual(matches,["Independent fixture"]);
 console.log("PASS: Chromium desktop and mobile, five authenticated pages each, no document overflow, real search submission; synthetic screenshots saved");
}finally{ws?.close();chrome.kill("SIGTERM");worker.kill("SIGTERM");await pause(500);rmSync(dir,{recursive:true,force:true});}
