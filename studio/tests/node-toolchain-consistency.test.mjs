import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";

// Pin the CI build toolchain to the same Node major that Vercel must select.
// npm can accept open-ended engines ranges; Vercel chooses the latest major.
test("SEC-13 package, lockfile, CI and running Node toolchain use a single pinned major",()=>{
  const pkg=JSON.parse(readFileSync(new URL("../package.json",import.meta.url),"utf8"));
  const lock=JSON.parse(readFileSync(new URL("../package-lock.json",import.meta.url),"utf8"));
  const workflow=readFileSync(new URL("../../.github/workflows/studio-verify.yml",import.meta.url),"utf8");
  assert.equal(pkg.engines.node,"24.x");
  assert.equal(lock.packages[""].engines.node,pkg.engines.node);
  assert.match(workflow,/node-version:\s*"24"/);
  assert.equal(Number(process.versions.node.split(".")[0]),24,
    "GitHub Actions must execute with Node 24, not a future major");
});
