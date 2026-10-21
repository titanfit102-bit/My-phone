import test from "node:test";
import assert from "node:assert/strict";
import {existsSync, readFileSync} from "node:fs";
import {resolve} from "node:path";

// Test is run from studio/ by npm run check:config, including in CI.
const root = resolve(import.meta.dirname, "../..");
const exists = path => existsSync(resolve(root,path));

test("Expo-only repository retains Studio source, CI and manifest adapter",()=>{
  for(const path of [
    "studio/App.tsx","studio/package.json","studio/package-lock.json",
    "studio/vercel.json",".github/workflows/studio-verify.yml",
    "templates/emit-build-info.mjs","docs/LIVE_SYNC_V04.md"
  ]) assert.ok(exists(path), "Missing Studio dependency: "+path);
});

test("retired standalone website, extension and obsolete workflow stay absent",()=>{
  for(const path of [
    "extension","web","scripts","tests",
    "package.json","vercel.json",".github/workflows/verify.yml"
  ]) assert.equal(exists(path),false,"Retired component reintroduced: "+path);
});

test("Studio workflow watches source and documentation without root demo pipeline",()=>{
  const workflow=readFileSync(resolve(root,".github/workflows/studio-verify.yml"),"utf8");
  assert.match(workflow,/studio\/\*\*/);
  assert.match(workflow,/docs\/\*\*/);
  assert.match(workflow,/README\.md/);
  assert.match(workflow,/npm ci/);
  assert.match(workflow,/npm run test:e2e/);
  assert.doesNotMatch(workflow,/verify\.yml/);
});
