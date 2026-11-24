// Generates isolated config files only. No Cloudflare API calls, login or deployment.
import {readFileSync,writeFileSync,existsSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {resolve} from "node:path";
export function stagingConfigs(slug,hub,fixture){
 if(!/^sc-test-[a-z0-9](?:[a-z0-9-]{0,20}[a-z0-9])?$/.test(slug))throw Error("Use a unique name starting sc-test-, 9–30 lowercase letters/numbers/hyphens.");
 const a=structuredClone(hub),b=structuredClone(fixture);
 a.name=slug;b.name=slug+"-fixture";
 for(const [cfg,prefix] of [[a,slug],[b,slug+"-fixture"]]){
   delete cfg.account_id;delete cfg.routes;delete cfg.route;delete cfg.env;delete cfg.vars;
   cfg.workers_dev=true;cfg.preview_urls=false;
   for(const item of cfg.d1_databases||[]){delete item.database_id;delete item.preview_database_id;item.database_name=prefix+"-db";}
   for(const item of cfg.kv_namespaces||[]){delete item.id;delete item.preview_id;}
 }
 b.vars={SITE_ID:"test-site"};
 return {hub:a,fixture:b};
}
function main(){
 const slug=process.argv[2]||"";
 const root=fileURLToPath(new URL("../",import.meta.url));
 const read=name=>JSON.parse(readFileSync(resolve(root,name),"utf8"));
 const cfg=stagingConfigs(slug,read("wrangler.jsonc"),read("wrangler.fixture.jsonc"));
 const targets=[["wrangler.staging.local.jsonc",cfg.hub],["wrangler.fixture.staging.local.jsonc",cfg.fixture]];
 if(targets.some(([name])=>existsSync(resolve(root,name))))throw Error("Staging files already exist; refusing overwrite. Review existing files manually.");
 for(const [name,value] of targets)writeFileSync(resolve(root,name),JSON.stringify(value,null,2)+"\n",{flag:"wx",mode:0o600});
 console.log("Prepared new local-only staging configs. No deployment performed.");
 console.log("Review Cloudflare account and confirm names are unused before deploying. See RELEASE.md.");
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{main()}catch(e){console.error(e.message);process.exitCode=1;}}
