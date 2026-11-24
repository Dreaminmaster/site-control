export function validateConfig(x){
  if(!x||typeof x!=="object"||Array.isArray(x)||Object.keys(x).sort().join(",")!=="maintenance,notice,title") throw Error("invalid_config");
  if(typeof x.title!=="string"||x.title.trim().length<1||x.title.length>100||typeof x.notice!=="string"||x.notice.length>1000||typeof x.maintenance!=="boolean") throw Error("invalid_config");
  return {title:x.title.trim(),notice:x.notice,maintenance:x.maintenance};
}

export function validateSiteId(x){if(typeof x!=="string"||!/^[a-z][a-z0-9-]{1,47}$/.test(x))throw Error("invalid_site_id");return x;}

export function checkRevision(x){if(!Number.isSafeInteger(x)||x<0||x>1000000000)throw Error("invalid_revision");return x;}

export function applyJob(local,job){
  if(!job||job.status!=="approved"||job.site_id!==local.site_id)throw Error("unauthorized_job");
  if(local.last_job===job.id) {
    if(local.revision!==job.expected_revision+1||JSON.stringify(validateConfig(local.config))!==JSON.stringify(validateConfig(job.config)))throw Error("receipt_conflict");
    return {state:local,replayed:true};
  }
  if(local.revision!==checkRevision(job.expected_revision))throw Error("stale_revision");
  return {state:{site_id:local.site_id,revision:local.revision+1,config:validateConfig(job.config),last_job:job.id},replayed:false};
}

export function authorized(grant,site,mode,now){
  return !!grant&&!grant.revoked&&grant.expires_at>now&&Array.isArray(grant.sites)&&grant.sites.includes(site)&&(mode==="read"||mode==="propose"&&grant.can_propose===true&&Array.isArray(grant.writable_sites)&&grant.writable_sites.includes(site));
}

export function isFresh(checked,now){return Number.isFinite(checked)&&checked>0&&now>=checked&&now-checked<=900000;}