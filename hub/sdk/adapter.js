import { applyJob,validateConfig,validateResourceSchema,validateSiteId,checkRevision } from "../src/core.js";
// Runs ONLY in a trusted site's server runtime. Never expose SITE_TOKEN to the browser.
// storage.read() must return {site_id,revision,config,last_job}; storage.cas(expectedRevision,next)
// MUST atomically compare the revision and write all state including last_job. Acknowledge only after durable commit.
export async function syncOnce({hubUrl,siteId,token,storage,resourceSchema=[],fetcher=fetch}){
 const schema=validateResourceSchema(resourceSchema);validateSiteId(siteId);const base=new URL(hubUrl);
 if(base.protocol!=="https:"||base.username||base.password||base.pathname!=="/"||base.search||base.hash||!(/^[a-f0-9]{64}$/.test(token)))throw Error("invalid_connection");
 const call=async(action,data)=>{const r=await fetcher(new URL("/api/sites/"+siteId+"/"+action,base),{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify(data),redirect:"error"});if(!r.ok)throw Error("hub_"+action+"_"+r.status);return r.json();};
 let local=await storage.read();if(local.site_id!==siteId)throw Error("wrong_site");checkRevision(local.revision);validateConfig(local.config,schema);
 // Poll before heartbeat to allow crash-after-commit receipt replay.
 const {job,resource_schema}=await call("poll",{});
 if(JSON.stringify(resource_schema||[])!==JSON.stringify(schema))throw Error("resource_schema_mismatch");
 if(job){
   let applied;
   try{applied=applyJob(local,job,schema);}catch(x){if(x.message==="stale_revision"){await call("ack",{id:job.id,ok:false});return {status:"stale_job"};}throw x;}
   if(!applied.replayed){
     if(!await storage.cas(local.revision,applied.state))throw Error("local_cas_conflict");
     local=await storage.read();
   }
   if(local.last_job!==job.id||local.revision!==job.expected_revision+1||JSON.stringify(validateConfig(local.config,schema))!==JSON.stringify(validateConfig(job.config,schema)))throw Error("durable_receipt_mismatch");
   await call("ack",{id:job.id,ok:true,revision:local.revision,config:local.config});
   return {status:"applied_or_replayed",revision:local.revision};
 }
 await call("heartbeat",{revision:local.revision,config:local.config,resource_schema:schema});return {status:"reported",revision:local.revision};
}
