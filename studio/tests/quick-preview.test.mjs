import test from "node:test";
import assert from "node:assert/strict";
import {makeZip} from "./zip-fixtures.mjs";
import {buildQuickPreview} from "../src/quick-preview.js";

function makeBuild(method=8){
  return makeZip([
    {name:"myapp-main/dist/index.html",method,content:'<!doctype html><html><head><link rel="stylesheet" href="/assets/site.css"><script type="module" src="/assets/site.js"></script></head><body><div id="root"></div></body></html>'},
    {name:"myapp-main/dist/assets/site.css",method,content:"#root{color:teal}"},
    {name:"myapp-main/dist/assets/site.js",method,content:"document.getElementById('root').textContent='Live ZIP Quick Preview';"}
  ]);
}
test("ZIP built assets are decoded and embedded in opaque iframe HTML",async()=>{
  const result=await buildQuickPreview(makeBuild(8),"demo.zip");
  assert.match(result.srcDoc,/Live ZIP Quick Preview/);
  assert.match(result.srcDoc,/root\{color:teal\}/);
  assert.match(result.srcDoc,/localStorage/);
  assert.match(result.srcDoc,/connect-src 'none'/);
  assert.equal(result.indexPath,"myapp-main/dist/index.html");
  assert.equal(result.filename,"demo.zip");
});
test("stored ZIP entries work without compression",async()=>{
  const result=await buildQuickPreview(makeBuild(0),"stored.zip");
  assert.match(result.srcDoc,/Live ZIP Quick Preview/);
});
test("source-only GitHub ZIP cannot be rendered without a build",async()=>{
  await assert.rejects(buildQuickPreview(makeZip([{name:"repo-main/package.json",content:"{}"},{name:"repo-main/src/App.tsx",content:"React"}]),"source.zip"),/dist\/index.html/);
});
test("missing JS prevents false success",async()=>{
  await assert.rejects(buildQuickPreview(makeZip([{name:"repo-main/dist/index.html",content:'<script type="module" src="/assets/missing.js"></script>'}]),"bad.zip"),/mungon/i);
});
test("unsafe paths cannot be rendered",async()=>{
  await assert.rejects(buildQuickPreview(makeZip([{name:"repo-main/dist/index.html",content:'<script type="module" src="/../../secret.js"></script>'}]),"bad.zip"),/pasigurta/i);
});
test("multiple builds rejected until explicit selection exists",async()=>{
  await assert.rejects(buildQuickPreview(makeZip([{name:"repo-main/dist/index.html",content:""},{name:"repo-main/build/index.html",content:""}]),"multiple.zip"),/disa build/);
});
test("no external asset loading is permitted",async()=>{
  await assert.rejects(buildQuickPreview(makeZip([{name:"repo-main/dist/index.html",content:'<script type="module" src="https://evil.invalid/a.js"></script>'}]),"bad.zip"),/jashtme|pambështetura/);
});
test("built JS cannot close the sandbox document script tag",async()=>{
  const data=makeZip([{name:"repo-main/dist/index.html",content:'<script type="module" src="/assets/index.js"></script>'},
    {name:"repo-main/dist/assets/index.js",content:'console.log("</script><h1>Injected</h1>");'}]);
  const result=await buildQuickPreview(data,"esc.zip");
  assert.ok(!result.srcDoc.includes('console.log("</script>'));
});
