import test from "node:test";
import assert from "node:assert/strict";
import {inspectZip,MAX_ZIP_BYTES,MAX_ZIP_ENTRIES} from "../src/zip-inspector.js";
import {makeZip} from "./zip-fixtures.mjs";

test("GitHub main download ZIP identifies Expo source but never claims preview is ready",()=>{
  const archive=makeZip([
    {name:"my-app-main/package.json",content:'{"dependencies":{"expo":"latest"}}'},
    {name:"my-app-main/app.json",content:'{"expo":{"name":"Demo"}}'},
    {name:"my-app-main/src/App.tsx",content:"export default () => null;"}
  ]);
  const found=inspectZip(archive,"my-app-main.zip");
  assert.equal(found.kind,"source");
  assert.match(found.framework,/Expo/);
  assert.equal(found.root,"my-app-main");
  assert.equal(found.count,3);
  assert.equal(found.previewReady,false);
  assert.match(found.advice,/build/i);
});

test("Vite and Next source projects are detected by structure",()=>{
  for(const [config,framework] of [["vite.config.ts","Vite"],["next.config.mjs","Next"]]) {
    const found=inspectZip(makeZip([{name:"repo-main/package.json",content:"{}"},
      {name:"repo-main/"+config,content:"export default {}"}]),"repo.zip");
    assert.match(found.framework,new RegExp(framework));
    assert.equal(found.previewReady,false);
  }
});
test("build-like HTML ZIP is only a candidate and does not execute or render",()=>{
  const result=inspectZip(makeZip([{name:"dist/index.html",content:"<script>alert('malicious')</script>"},
    {name:"dist/assets/main.js",content:"alert('malicious')"}]),"dist.zip");
  assert.equal(result.kind,"static");
  assert.equal(result.previewReady,false);
  assert.match(result.advice,/nuk është ekzekutuar/i);
});
test("invalid, truncated and non-ZIP files are rejected",()=>{
  assert.throws(()=>inspectZip(new ArrayBuffer(3),"bad.zip"));
  assert.throws(()=>inspectZip(new Uint8Array(50).buffer,"bad.zip"));
  assert.throws(()=>inspectZip(makeZip([{name:"a.txt"}],{corruptSignature:true}),"bad.zip"));
  assert.throws(()=>inspectZip(makeZip([{name:"a.txt"}]),"not-an-archive.txt"));
});
test("archive paths reject traversal, backslashes, NUL and absolute paths",()=>{
  for(const path of ["../secret",".hidden/../secret","/etc/passwd","C:/Windows/a","repo-main/../../bad","repo-main/evil\\path","foo\0bar"]) {
    assert.throws(()=>inspectZip(makeZip([{name:path}]),"bad.zip"),path);
  }
});
test("duplicate names and names colliding after GitHub prefix normalization are rejected",()=>{
  assert.throws(()=>inspectZip(makeZip([{name:"repo-main/src/app.js"},{name:"repo-main/src/app.js"}]),"dup.zip"));
  assert.throws(()=>inspectZip(makeZip([{name:"repo-main/A.js"},{name:"repo-main/a.js"}]),"dup.zip"));
});
test("encrypted, unsupported compression and symlinks are rejected",()=>{
  for(const item of [
    {name:"a.txt",flags:1},{name:"a.txt",method:99},
    {name:"a.txt",attrs:0xa1ff0000}
  ])assert.throws(()=>inspectZip(makeZip([item]),"bad.zip"));
});
test("ZIP64 and declared zip-bomb-like archives are rejected without decompressing",()=>{
  assert.throws(()=>inspectZip(makeZip([{name:"a.txt",size:0xffffffff}]),"bad.zip"));
  assert.throws(()=>inspectZip(makeZip([{name:"a.txt",size:500*1024*1024},{name:"b.txt",size:80*1024*1024}]),"bad.zip"));
  assert.equal(MAX_ZIP_BYTES,32*1024*1024);
  assert.equal(MAX_ZIP_ENTRIES,5000);
});
test("no files are executed, no network calls and no binary data is stored",()=>{
  const data=makeZip([{name:"demo-main/README.md",content:"# Example"}]);
  const result=inspectZip(data,"demo.zip");
  assert.equal(result.previewReady,false);
  assert.equal(result.kind,"unknown");
  assert.deepEqual(result.sample,["README.md"]);
});
