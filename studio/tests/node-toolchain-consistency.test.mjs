import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
import {assertStudioBuildNodeVersion} from "../scripts/verify-node-runtime.mjs";

// Pin the CI build toolchain to the same Node major that Vercel must select.
// npm can accept open-ended engines ranges; Vercel chooses the latest major.
test("SEC-13 package, lockfile, CI and running Node toolchain use a single pinned major",()=>{
  const pkg=JSON.parse(readFileSync(new URL("../package.json",import.meta.url),"utf8"));
  const lock=JSON.parse(readFileSync(new URL("../package-lock.json",import.meta.url),"utf8"));
  const workflow=readFileSync(new URL("../../.github/workflows/studio-verify.yml",import.meta.url),"utf8");
  assert.equal(pkg.engines.node,"24.x");
  assert.equal(pkg.scripts["export:web"],
    "node scripts/verify-node-runtime.mjs && expo export --platform web && node scripts/emit-build-info.mjs");
  assert.equal(lock.packages[""].engines.node,pkg.engines.node);
  assert.match(workflow,/node-version:\s*"24"/);
  assert.equal(Number(process.versions.node.split(".")[0]),24,
    "GitHub Actions must execute with Node 24, not a future major");
});

// Unlike package-only tests, this verifies that Vercel's actual export command
// fails closed on its runtime and emits an observable major-version proof.
test("SEC-13 Studio export guard accepts Node 24 and rejects unsafe/future majors",()=>{
  assert.equal(assertStudioBuildNodeVersion("v24.11.1"),"v24.11.1");
  assert.equal(assertStudioBuildNodeVersion("24.0.0"),"24.0.0");
  for (const bad of ["v22.14.0","v26.0.0","v25.0.0","24.x","v24.1.0-beta","",null,{},0]) {
    assert.throws(()=>assertStudioBuildNodeVersion(bad),/requires Node.js 24\\.x/);
  }
  assert.equal(assertStudioBuildNodeVersion(process.version),process.version);
});
