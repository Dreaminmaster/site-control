import test from "node:test";
import assert from "node:assert/strict";
import {stagingConfigs} from "../scripts/prepare-staging.mjs";
test("isolated staging configs cannot reuse existing IDs or routes",()=>{
 const hub={name:"production",account_id:"old",routes:["prod"],vars:{SECRET:"old"},d1_databases:[{binding:"DB",database_name:"prod",database_id:"old",preview_database_id:"old"}],kv_namespaces:[{binding:"OAUTH_KV",id:"old",preview_id:"old"}]};
 const fixture={name:"old",d1_databases:[{binding:"FIXTURE_DB",database_id:"old"}]};
 const result=stagingConfigs("sc-test-demo",hub,fixture);
 assert.equal(result.hub.name,"sc-test-demo");assert.equal(result.fixture.name,"sc-test-demo-fixture");
 assert.equal(result.hub.d1_databases[0].database_name,"sc-test-demo-db");
 assert.equal(result.fixture.d1_databases[0].database_name,"sc-test-demo-fixture-db");
 assert.equal(result.hub.account_id,undefined);assert.equal(result.hub.routes,undefined);assert.equal(result.hub.vars,undefined);
 assert.equal(result.hub.kv_namespaces[0].id,undefined);assert.equal(result.hub.d1_databases[0].database_id,undefined);
 assert.equal(result.fixture.vars.SITE_ID,"test-site");assert.equal(hub.name,"production");
 assert.throws(()=>stagingConfigs("production",hub,fixture));
});
