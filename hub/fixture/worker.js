import {syncOnce} from "../sdk/adapter.js";
import {validateConfig,validateSiteId,checkRevision} from "../src/core.js";
const noCache={"Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer","X-Frame-Options":"DENY"};
const json=(x,status=200)=>Response.json(x,{status,headers:noCache});
const h=(v)=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export function createStorage(db,siteId){
 validateSiteId(siteId);
 return {
  async read(){const r=await db.prepare("SELECT * FROM fixture_config WHERE site_id=?").bind(siteId).first();if(!r)throw Error("fixture_not_initialized");return {site_id:r.site_id,revision:r.revision,config:validateConfig(JSON.parse(r.config)),last_job:r.last_job};},
  async cas(expected,next){checkRevision(expected);if(next.site_id!==siteId||next.revision!==expected+1)throw Error("invalid_cas");const r=await db.prepare("UPDATE fixture_config SET revision=?,config=?,last_job=? WHERE site_id=? AND revision=?").bind(next.revision,JSON.stringify(validateConfig(next.config)),next.last_job,siteId,expected).run();return r.meta.changes===1;}
 };
}
async function fixedHash(s){return new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)));}
async function isAdmin(r,e){if(!e.FIXTURE_ADMIN_TOKEN||e.FIXTURE_ADMIN_TOKEN.length<32)return false;const v=r.headers.get("Authorization")||"";if(v.length>256||!v.startsWith("Bearer "))return false;const [a,b]=await Promise.all([fixedHash(v.slice(7)),fixedHash(e.FIXTURE_ADMIN_TOKEN)]);let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0;}
export function fixtureHandler(fetcher=fetch){
 return {async fetch(r,e){
  try{
    const u=new URL(r.url);if(!e.FIXTURE_DB||!e.SITE_ID)return json({error:"fixture_setup_required"},503);
    const storage=createStorage(e.FIXTURE_DB,e.SITE_ID);
    if(u.pathname==="/health"&&r.method==="GET")return json({service:"site-control-fixture",initialized:!!await storage.read()});
    if(u.pathname==="/"&&r.method==="GET"){const x=await storage.read();return new Response('<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+h(x.config.title)+'</title><body style="font:16px system-ui;margin:36px;max-width:720px"><p>Site Control · 独立测试站 · 仅假数据</p><h1>'+h(x.config.title)+'</h1><p>'+h(x.config.notice)+'</p><p>维护模式：'+(x.config.maintenance?"开":"关")+' · revision '+x.revision+'</p></body></html>',{headers:{...noCache,"Content-Type":"text/html; charset=utf-8","Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'"}});}
    if(!u.pathname.startsWith("/admin"))return json({error:"not_found"},404);
    if(!await isAdmin(r,e))return json({error:"admin_denied"},401);
    if(u.pathname==="/admin"&&r.method==="GET")return json(await storage.read());
    if(u.pathname==="/admin/sync"&&r.method==="POST"){
       if(!e.HUB_URL||!e.SITE_TOKEN)return json({error:"hub_connection_not_configured"},503);
       return json(await syncOnce({hubUrl:e.HUB_URL,siteId:e.SITE_ID,token:e.SITE_TOKEN,storage,fetcher}));
    }
    if(u.pathname==="/admin/config"&&r.method==="POST"){
       const length=Number(r.headers.get("content-length")||0);if(length>4096)return json({error:"too_large"},413);
       // Fixture accepts compact owner requests only; production business adapters need streaming size limits.
       const text=await r.text();if(text.length>4096)return json({error:"too_large"},413);
       const b=JSON.parse(text),rev=checkRevision(b.expected_revision),current=await storage.read();
       if(rev!==current.revision)return json({error:"stale_revision"},409);
       const next={site_id:e.SITE_ID,revision:rev+1,config:validateConfig(b.config),last_job:null};
       if(!await storage.cas(rev,next))return json({error:"stale_revision"},409);return json(next);
    }
    return json({error:"not_found"},404);
  }catch{return json({error:"fixture_request_failed"},500);}
 }};
}
export default fixtureHandler();
