import test from "node:test";
import assert from "node:assert/strict";
import {inspectZip} from "../src/zip-inspector.js";
import {assessZipInspection,ENGINE_SCHEMA} from "../src/engine-core.js";
import {makeZip} from "./zip-fixtures.mjs";

const inspect=paths=>inspectZip(makeZip(paths.map(([name,content])=>({name,content}))),"my-app.zip");

test("source-only Expo ZIP requires a build without claiming any executable preview",()=>{
  const zip=inspect([
    ["repo-main/package.json",'{"name":"demo"}'],
    ["repo-main/app.json",'{"expo":{}}'],
    ["repo-main/src/App.tsx","export default () => null"]
  ]);
  assert.equal(zip.kind,"source");
  assert.equal(zip.buildCandidateCount,0);
  const result=assessZipInspection(zip);
  assert.equal(result.schema,ENGINE_SCHEMA);
  assert.equal(result.decision.status,"build_required");
  assert.equal(result.decision.previewMode,null);
  assert.equal(result.decision.previewPrepared,false);
  assert.equal(result.decision.requiresBuild,true);
  assert.equal(result.decision.verifiedExecution,false);
  assert.equal(result.diagnostics[0].code,"SOURCE_BUILD_REQUIRED");
  assert.deepEqual(result.security,{
    uploadedToCloud:false,persistedByEngine:false,executedByEngine:false,
    renderBoundary:"opaque-origin-sandbox-only"
  });
});

test("a repository containing both Expo source and dist remains a build candidate",()=>{
  const zip=inspect([
    ["repo-main/package.json",'{"name":"demo"}'],
    ["repo-main/app.json","{}"],
    ["repo-main/src/App.tsx","export default null"],
    ["repo-main/dist/index.html",'<!doctype html><script src="/assets/main.js"></script>'],
    ["repo-main/dist/assets/main.js","console.log('demo')"]
  ]);
  assert.equal(zip.kind,"source");
  assert.equal(zip.buildCandidateCount,1);
  assert.deepEqual(zip.buildCandidates,["dist/index.html"]);
  const original=JSON.stringify(zip);
  const candidate=assessZipInspection(zip);
  assert.equal(candidate.decision.status,"candidate");
  assert.equal(candidate.decision.previewMode,"zip-offline");
  assert.equal(candidate.decision.previewPrepared,false);
  assert.equal(candidate.source.entrypoint,"dist/index.html");
  const prepared=assessZipInspection(zip,{status:"prepared"});
  assert.equal(prepared.decision.status,"prepared");
  assert.equal(prepared.decision.previewPrepared,true);
  assert.equal(prepared.decision.verifiedExecution,false);
  assert.match(prepared.diagnostics[0].detail,/nuk verifikon/);
  assert.equal(JSON.stringify(zip),original,"Core must not mutate inspection metadata");
});

test("HTML entrypoint is only a candidate, not a working preview",()=>{
  const zip=inspect([["dist/index.html","<html>Incomplete</html>"]]);
  const candidate=assessZipInspection(zip);
  assert.equal(candidate.decision.status,"candidate");
  assert.equal(candidate.decision.previewPrepared,false);
  const error=assessZipInspection(zip,{status:"failed",error:"Mungon JS bundle."});
  assert.equal(error.decision.status,"failed");
  assert.equal(error.decision.code,"ZIP_RENDER_FAILED");
  assert.equal(error.decision.previewMode,null);
  assert.match(error.diagnostics[0].detail,/Mungon JS bundle/);
});

test("multiple build roots are refused rather than auto-selected",()=>{
  const zip=inspect([
    ["dist/index.html","<html/>"],
    ["out/index.html","<html/>"]
  ]);
  assert.equal(zip.buildCandidateCount,2);
  const decision=assessZipInspection(zip);
  assert.equal(decision.decision.status,"unsupported");
  assert.equal(decision.diagnostics[0].code,"MULTIPLE_WEB_BUILDS");
  assert.equal(decision.decision.previewPrepared,false);
  assert.throws(()=>assessZipInspection(zip,{status:"prepared"}),/one selected/);
});

test("root index.html alone is not reported as a verified supported Vite build",()=>{
  const zip=inspect([["index.html","<html>Standalone</html>"]]);
  assert.equal(zip.buildCandidateCount,0);
  assert.equal(assessZipInspection(zip).decision.status,"unsupported");
});

test("native source requires an APK and unfamiliar archives stay unsupported",()=>{
  const native=inspect([["android/app/build.gradle","apply plugin: 'com.android.application'"]]);
  assert.equal(native.kind,"native");
  assert.equal(assessZipInspection(native).decision.status,"native_build_required");
  const unknown=inspect([["README.md","# unknown"]]);
  assert.equal(assessZipInspection(unknown).decision.status,"unsupported");
});

test("invalid input and forged ready state do not silently pass",()=>{
  assert.throws(()=>assessZipInspection(null),/validated ZIP/);
  assert.throws(()=>assessZipInspection({kind:"source"}),/normalized/);
  assert.throws(()=>assessZipInspection({buildCandidateCount:1,buildCandidates:[],kind:"static"}),/normalized/);
  const src=inspect([["repo-main/package.json","{}"]]);
  assert.throws(()=>assessZipInspection(src,{status:"prepared"}),/one selected/);
  assert.throws(()=>assessZipInspection(src,{status:"unknown"}),/unknown/);
});

test("renderer error messages are bounded plain text and are not persisted or executed",()=>{
  const zip=inspect([["dist/index.html","<html/>"]]);
  const long="<script>alert('x')</script>".repeat(50);
  const report=assessZipInspection(zip,{status:"failed",error:long+"\nsecret"});
  assert.ok(report.diagnostics[0].detail.length<=260);
  assert.equal(report.decision.verifiedExecution,false);
  assert.equal(report.security.persistedByEngine,false);
  assert.equal(report.security.executedByEngine,false);
});

test("candidate list is bounded while count retains ambiguity",()=>{
  const entries=Array.from({length:14},(_,i)=>["section-"+i+"/dist/index.html","<html/>"]);
  const zip=inspect(entries);
  assert.equal(zip.buildCandidateCount,14);
  assert.equal(zip.buildCandidates.length,10);
  assert.equal(assessZipInspection(zip).decision.status,"unsupported");
});
