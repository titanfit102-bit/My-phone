import {readFileSync} from "node:fs";
import {test} from "node:test";
import assert from "node:assert/strict";

// A wildcard header rule with `has` or `missing` is CONDITIONAL, and may
// leave the Studio document frameable. Fail closed if this policy weakens.
export function assertUnconditionalStudioFramingDenied(config) {
  assert.equal(config.version,2);
  assert.equal(config.outputDirectory,"dist");
  assert.equal(config.buildCommand,"npm run export:web");
  assert.equal(config.cleanUrls,true);
  assert.ok(Array.isArray(config.headers),"Vercel header policy is required");
  assert.equal(config.headers.length,1,"Unexpected additional header rule");

  const rule=config.headers[0];
  assert.ok(rule && typeof rule==="object");
  assert.deepEqual(Object.keys(rule).sort(),["headers","source"],
    "Header rule must be unconditional: no has/missing or other filters");
  assert.equal(rule.source,"/(.*)","Require an all-path security header rule");
  assert.ok(Array.isArray(rule.headers));
  assert.equal(rule.headers.length,3,"Require exactly the three security headers");

  const entries=new Map();
  for (const header of rule.headers) {
    assert.ok(header && typeof header==="object");
    assert.deepEqual(Object.keys(header).sort(),["key","value"]);
    assert.equal(typeof header.key,"string");
    assert.equal(typeof header.value,"string");
    const key=header.key.toLowerCase();
    assert.ok(!entries.has(key),"Duplicate security header: "+key);
    entries.set(key,header.value);
  }
  assert.deepEqual([...entries.keys()].sort(),[
    "content-security-policy","x-content-type-options","x-frame-options"
  ]);
  assert.equal(entries.get("content-security-policy"),"frame-ancestors 'none'");
  assert.equal(entries.get("x-frame-options"),"DENY");
  assert.equal(entries.get("x-content-type-options"),"nosniff");
}

const loadConfig=()=>JSON.parse(
  readFileSync(new URL("../vercel.json",import.meta.url),"utf8")
);

test("SEC-04 Vercel all-route response headers deny framing unconditionally",()=>{
  assertUnconditionalStudioFramingDenied(loadConfig());
});

test("SEC-04 policy validation rejects conditional or weaker header rules",()=>{
  const mutations=[
    ["query-conditioned",p=>{p.headers[0].has=[{type:"query",key:"authorized"}];}],
    ["cookie-conditioned",p=>{p.headers[0].has=[{type:"cookie",key:"session"}];}],
    ["missing-conditioned",p=>{p.headers[0].missing=[{type:"header",key:"test"}];}],
    ["different source",p=>{p.headers[0].source="/protected/(.*)";}],
    ["extra rule",p=>{p.headers.push({source:"/private",headers:[]});}],
    ["duplicate header",p=>{p.headers[0].headers.push({...p.headers[0].headers[0]});}],
    ["weaker CSP",p=>{p.headers[0].headers[0].value="frame-ancestors 'self'";}],
    ["weaker XFO",p=>{p.headers[0].headers[1].value="SAMEORIGIN";}],
    ["missing nosniff",p=>{p.headers[0].headers.pop();}],
    ["unreviewed header attribute",p=>{p.headers[0].headers[0].has=[];}]
  ];
  for (const [name,change] of mutations) {
    const bad=loadConfig();
    change(bad);
    assert.throws(()=>assertUnconditionalStudioFramingDenied(bad),undefined,name);
  }
});
