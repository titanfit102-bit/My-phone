import test from "node:test";
import assert from "node:assert/strict";
import {evaluateAudit} from "../scripts/verify-security-audit.mjs";

const make=(vulnerabilities,counts={critical:0,high:0,moderate:0})=>
  ({metadata:{vulnerabilities:counts},vulnerabilities});
const root=(url,severity="high")=>({severity,via:[{url,severity}]});
const braces="https://github.com/advisories/GHSA-vfj7-8cjw-p6xm";
const forge="https://github.com/advisories/GHSA-86w9-cpqp-85rv";

test("clean npm audit passes",()=>{
  const r=evaluateAudit(make({}));
  assert.equal(r.pass,true);
  assert.deepEqual(r.blocking,[]);
  assert.deepEqual(r.exceptional,[]);
});
test("moderate build-time findings are visible but not automatically blocked",()=>{
  const moderate={severity:"moderate",via:[{url:"https://github.com/advisories/GHSA-3g3m-2fjr-6pw4",severity:"moderate"}]};
  const r=evaluateAudit(make({glob:moderate,minimatch:moderate},{critical:0,high:0,moderate:4}));
  assert.equal(r.pass,true);
  assert.equal(r.counts.moderate,4);
});
test("formerly reviewed High advisories now fail even before their previous expiry",()=>{
  const v={braces:root(braces),micromatch:{severity:"high",via:["braces"]},
    "node-forge":root(forge),expo:{severity:"high",via:["micromatch","node-forge"]}};
  const r=evaluateAudit(make(v,{critical:0,high:4,moderate:4}));
  assert.equal(r.pass,false);
  assert.equal(r.exceptional.length,0);
  assert.equal(r.blocking.length,4);
  assert.deepEqual(r.blocking.find(x=>x.package==="expo").rootIds.sort(),[
    "GHSA-86w9-cpqp-85rv","GHSA-vfj7-8cjw-p6xm"
  ]);
});
test("a new High finding always fails",()=>{
  const r=evaluateAudit(make({other:root("https://github.com/advisories/GHSA-aaaa-bbbb-cccc")},{critical:0,high:1,moderate:0}));
  assert.equal(r.pass,false);
  assert.equal(r.blocking[0].package,"other");
});
test("a High dependency path with only a Moderate root still fails",()=>{
  const moderate={url:"https://github.com/advisories/GHSA-g3hv-75wg-m249",severity:"moderate"};
  const v={minimatch:{severity:"moderate",via:[moderate]},expo:{severity:"high",via:["minimatch"]}};
  const r=evaluateAudit(make(v,{critical:0,high:1,moderate:1}));
  assert.equal(r.pass,false);
  assert.deepEqual(r.blocking[0].rootIds,[]);
});
test("a Critical finding always fails",()=>{
  const r=evaluateAudit(make({braces:root(braces,"critical")},{critical:1,high:0,moderate:0}));
  assert.equal(r.pass,false);
});
test("mismatched audit counts cannot conceal High or Critical findings",()=>{
  const counts={critical:0,high:0,moderate:0};
  assert.equal(evaluateAudit(make({braces:root(braces)},counts)).pass,false);
  assert.equal(evaluateAudit(make({},{critical:1,high:0,moderate:0})).pass,false);
  assert.equal(evaluateAudit(make({},{critical:0,high:1,moderate:0})).pass,false);
});
test("malformed results fail closed",()=>{
  for(const item of [{},null,make({},{}),make([]),make({},{critical:0,high:-1,moderate:0})]){
    assert.throws(()=>evaluateAudit(item));
  }
  assert.equal(evaluateAudit(make({mystery:{severity:"high",via:[]}},{critical:0,high:1,moderate:0})).pass,false);
});
test("cyclic transitive references cannot create audit recursion",()=>{
  const v={a:{severity:"high",via:["b"]},b:{severity:"high",via:["a"]}};
  const r=evaluateAudit(make(v,{critical:0,high:2,moderate:0}));
  assert.equal(r.pass,false);
  assert.equal(r.blocking.length,2);
});
