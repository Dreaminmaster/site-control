const plain=x=>!!x&&typeof x==="object"&&!Array.isArray(x)&&[Object.prototype,null].includes(Object.getPrototypeOf(x));
const sameKeys=(obj,keys)=>plain(obj)&&Object.keys(obj).sort().join(",")===keys.slice().sort().join(",");
const safeName=x=>typeof x==="string"&&/^[a-z][a-z0-9_]{0,31}$/.test(x)&&!["id","constructor","prototype","__proto__","resources","title","notice","maintenance"].includes(x);
const fieldName=x=>typeof x==="string"&&/^[a-z][a-z0-9_]{0,31}$/.test(x)&&!["id","constructor","prototype","__proto__"].includes(x);
const bounded=(x,n)=>typeof x==="string"&&x.length<=n;
const byteLength=x=>new TextEncoder().encode(JSON.stringify(x)).length;
// Immutable, owner-selected resource definitions. No arbitrary JSON schema, code or URLs to execute.
export function validateResourceSchema(x=[]){
 if(!Array.isArray(x)||x.length>4)throw Error("invalid_resource_schema");
 const ids=new Set();
 return x.map(r=>{
  if(!sameKeys(r,["id","label","fields","max_records"])||!safeName(r.id)||ids.has(r.id)||!bounded(r.label,80)||!r.label.trim()||!Number.isSafeInteger(r.max_records)||r.max_records<1||r.max_records>25||!Array.isArray(r.fields)||r.fields.length<1||r.fields.length>8)throw Error("invalid_resource_schema");
  ids.add(r.id);const names=new Set();
  const fields=r.fields.map(f=>{
   if(!sameKeys(f,["name","type"])||!fieldName(f.name)||names.has(f.name)||!["text","boolean","number","https_url"].includes(f.type))throw Error("invalid_resource_field");
   names.add(f.name);return {name:f.name,type:f.type};
  });
  return {id:r.id,label:r.label,fields,max_records:r.max_records};
 });
}
export function validateResourceValue(rows,def){
 if(!Array.isArray(rows)||rows.length>def.max_records)throw Error("invalid_resource_records");
 const ids=new Set();
 return rows.map(row=>{
   if(!sameKeys(row,["id",...def.fields.map(f=>f.name)])||typeof row.id!=="string"||!/^[A-Za-z0-9_-]{1,64}$/.test(row.id)||ids.has(row.id))throw Error("invalid_resource_record");
   ids.add(row.id);const out={id:row.id};
   for(const f of def.fields){
    const v=row[f.name];
    if(f.type==="text"&&!bounded(v,500)||f.type==="boolean"&&typeof v!=="boolean"||f.type==="number"&&(typeof v!=="number"||!Number.isFinite(v)||Math.abs(v)>1e12))throw Error("invalid_resource_value");
    if(f.type==="https_url"){
     let u;try{u=new URL(v)}catch{throw Error("invalid_resource_url")}
     if(!bounded(v,500)||u.protocol!=="https:"||u.username||u.password)throw Error("invalid_resource_url");
    }
    out[f.name]=v;
   }
   return out;
 });
}
export function validateConfig(x,rawSchema=[]){
 const schema=validateResourceSchema(rawSchema);
 const keys=schema.length?["maintenance","notice","title","resources"]:["maintenance","notice","title"];
 if(!sameKeys(x,keys)||typeof x.title!=="string"||x.title.trim().length<1||x.title.length>100||typeof x.notice!=="string"||x.notice.length>1000||typeof x.maintenance!=="boolean")throw Error("invalid_config");
 const out={title:x.title.trim(),notice:x.notice,maintenance:x.maintenance};
 if(schema.length){
  if(!sameKeys(x.resources,schema.map(s=>s.id)))throw Error("invalid_resource_keys");
  out.resources=Object.fromEntries(schema.map(s=>[s.id,validateResourceValue(x.resources[s.id],s)]));
 }
 if(byteLength(out)>8000)throw Error("config_too_large");
 return out;
}

export function validateSiteId(x){if(typeof x!=="string"||!/^[a-z][a-z0-9-]{1,47}$/.test(x))throw Error("invalid_site_id");return x;}

export function checkRevision(x){if(!Number.isSafeInteger(x)||x<0||x>1000000000)throw Error("invalid_revision");return x;}

export function applyJob(local,job,schema=[]){
  if(!job||job.status!=="approved"||job.site_id!==local.site_id)throw Error("unauthorized_job");
  if(local.last_job===job.id) {
    if(local.revision!==job.expected_revision+1||JSON.stringify(validateConfig(local.config,schema))!==JSON.stringify(validateConfig(job.config,schema)))throw Error("receipt_conflict");
    return {state:local,replayed:true};
  }
  if(local.revision!==checkRevision(job.expected_revision))throw Error("stale_revision");
  return {state:{site_id:local.site_id,revision:local.revision+1,config:validateConfig(job.config,schema),last_job:job.id},replayed:false};
}

export function authorized(grant,site,mode,now){
  return !!grant&&!grant.revoked&&grant.expires_at>now&&Array.isArray(grant.sites)&&grant.sites.includes(site)&&(mode==="read"||mode==="propose"&&grant.can_propose===true&&Array.isArray(grant.writable_sites)&&grant.writable_sites.includes(site));
}

export function isFresh(checked,now){return Number.isFinite(checked)&&checked>0&&now>=checked&&now-checked<=900000;}