// Test only. Uses local D1 and a newly created temporary restore directory.
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
const dir=mkdtempSync(join(tmpdir(),"sc-recovery-"));
const wrangler="./node_modules/.bin/wrangler";
const run=args=>execFileSync(wrangler,args,{encoding:"utf8",stdio:["ignore","pipe","pipe"],env:{...process.env,CI:"true"}});
const backup=join(dir,"backup.sql"),target=join(dir,"restore");
const query=(sql,restored=false)=>JSON.parse(run(["d1","execute","DB","--local","--json",...(restored?["--persist-to",target]:[]),"--command",sql]))[0].results;
try{
 const before=query("SELECT id,revision,config,revoked FROM sites ORDER BY id");
 assert.ok(before.length>=3,"runtime fixture data must exist");
 const history=query("SELECT id,site_id,status,expected_revision FROM proposals ORDER BY id");
 const audit=query("SELECT count(*) AS n FROM audit")[0].n;
 run(["d1","export","DB","--local","--output",backup]);
 run(["d1","execute","DB","--local","--persist-to",target,"--file",backup]);
 assert.deepEqual(query("SELECT id,revision,config,revoked FROM sites ORDER BY id",true),before);
 assert.deepEqual(query("SELECT id,site_id,status,expected_revision FROM proposals ORDER BY id",true),history);
 assert.equal(query("SELECT count(*) AS n FROM audit",true)[0].n,audit);
 // Recovery must NOT reactivate old authorization or pending/in-flight changes.
 query("UPDATE proposals SET status='rejected',updated_at=unixepoch()*1000 WHERE status='pending'; UPDATE proposals SET status='failed',updated_at=unixepoch()*1000 WHERE status='approved'; UPDATE sites SET revoked=1,last_seen=NULL; UPDATE agents SET revoked=1; DELETE FROM sessions; DELETE FROM login_flows; DELETE FROM consent_flows; DELETE FROM rate_limits;",true);
 assert.equal(query("SELECT count(*) AS n FROM sites WHERE revoked=0",true)[0].n,0);
 assert.equal(query("SELECT count(*) AS n FROM agents WHERE revoked=0",true)[0].n,0);
 assert.equal(query("SELECT count(*) AS n FROM sessions",true)[0].n,0);
 assert.equal(query("SELECT count(*) AS n FROM proposals WHERE status IN ('pending','approved')",true)[0].n,0);
 assert.deepEqual(query("SELECT id,revision,config,revoked FROM sites ORDER BY id"),before);
 console.log("PASS: actual local D1 SQL export/import into isolated restore, exact config/history/audit, fail-closed credential recovery, source unchanged");
}finally{rmSync(dir,{recursive:true,force:true});}
