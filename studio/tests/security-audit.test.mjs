import test from "node:test";
import assert from "node:assert/strict";
import {evaluateAudit,BASELINE_HIGH_COUNT} from "../scripts/verify-security-audit.mjs";
const make=(vulnerabilities,counts={critical:0,high:0,moderate:0})=>
  ({metadata:{vulnerabilities:counts},vulnerabilities});
const root=(url, severity="high")=>({severity,via:[{url}]});
const braces="https://github.com/advisories/GHSA-vfj7-8cjw-p6xm";
const forge="https://github.com/advisories/GHSA-86w9-cpqp-85rv";
test("clean npm audit passes",()=>assert.equal(evaluateAudit(make({})).pass,true));
test("reviewed upstream advisories propagate to transitive Expo/Metro paths",()=>{
 const v={braces:root(braces),micromatch:{severity:"high",via:["braces"]},
   metro:{severity:"high",via:["micromatch"]}, "node-forge":root(forge),
   expo:{severity:"high",via:["metro","node-forge"]}};
 const r=evaluateAudit(make(v,{critical:0,high:5,moderate:7}),"2026-10-21");
 assert.equal(r.pass,true);assert.equal(r.exceptional.length,5);
 assert.equal(r.blocking.length,0);
});
test("unexpected high severity advisory cannot be suppressed by baseline",()=>{
 const r=evaluateAudit(make({other:root("https://github.com/advisories/GHSA-aaaa-bbbb-cccc")},
    {critical:0,high:1,moderate:0}));
 assert.equal(r.pass,false);assert.equal(r.blocking[0].package,"other");
});
test("critical always blocks even if advisory is reviewed",()=>{
 const r=evaluateAudit(make({braces:root(braces,"critical")},{critical:1,high:0,moderate:0}));
 assert.equal(r.pass,false);
});
test("a growing count fails even for a reviewed advisory",()=>{
 const r=evaluateAudit(make({braces:root(braces)},
   {critical:0,high:BASELINE_HIGH_COUNT+1,moderate:0}));
 assert.equal(r.pass,false);assert.ok(r.blocking.some(x=>x.package==="BASELINE_GROWTH"));
});
test("exceptions expire and require explicit reapproval",()=>{
 const r=evaluateAudit(make({braces:root(braces)},{critical:0,high:1,moderate:0}),"2026-11-22");
 assert.equal(r.pass,false);
});
test("missing, malformed or unexplained audit results block",()=>{
 assert.throws(()=>evaluateAudit({}));
 assert.equal(evaluateAudit(make({a:{severity:"high",via:[]}},
   {critical:0,high:1,moderate:0})).pass,false);
 assert.equal(evaluateAudit(make({},{critical:1,high:0,moderate:0})).pass,false);
});
