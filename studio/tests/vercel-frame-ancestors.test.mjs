import {readFileSync} from "node:fs";
import {test} from "node:test";
import assert from "node:assert/strict";

test("SEC-04 deployed Studio must deny being embedded at every route",()=>{
  const config=JSON.parse(readFileSync(new URL("../vercel.json",import.meta.url),"utf8"));
  assert.equal(config.version,2);
  assert.equal(config.outputDirectory,"dist");
  assert.equal(config.buildCommand,"npm run export:web");
  assert.equal(config.cleanUrls,true);
  assert.ok(Array.isArray(config.headers),"Vercel header policy is required");
  // All routes, including the root SPA and any direct HTML/asset route, must
  // be covered. 'self' is NOT safe for a native iframe redirected to Studio.
  const policy=config.headers.find(rule=>rule.source==="/(.*)");
  assert.ok(policy,"Require an all-path security header rule");
  const values=new Map(policy.headers.map(header=>[
    String(header.key).toLowerCase(),String(header.value)
  ]));
  assert.equal(values.get("content-security-policy"),"frame-ancestors 'none'");
  assert.equal(values.get("x-frame-options"),"DENY");
  assert.equal(values.get("x-content-type-options"),"nosniff");
  assert.equal(config.headers.length,1,"Unexpected additional Vercel header override");
});
