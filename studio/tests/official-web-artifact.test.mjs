import test from "node:test";
import assert from "node:assert/strict";
import {makeZip} from "./zip-fixtures.mjs";
import {inspectZip} from "../src/zip-inspector.js";
import {buildExpoWebArtifactPreview,buildSupportedWebPreview} from "../src/quick-preview.js";

const png=Uint8Array.from(Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEUlEQVR42mPQKXj3H4QZYAwAVWgKJasJe+IAAAAASUVORK5CYII=",
  "base64"));
const asset="/assets/assets/pixel.abc123.png";
const html='<!doctype html><html><head><title>PoF Expo</title></head><body><div id="root"></div>'+
  '<script src="/_expo/static/js/web/AppEntry-123abc.js" defer></script></body></html>';
const main='const image={uri:"'+asset+'"};document.getElementById("root").textContent="Expo ZIP";'+
  'window.__testImage=image.uri;';
function expoFiles(prefix="dist/"){
  return [
    {name:prefix+"index.html",content:html},
    {name:prefix+"metadata.json",content:'{"version":0,"bundler":"metro","fileMetadata":{}}'},
    {name:prefix+"_expo/static/js/web/AppEntry-123abc.js",content:main},
    {name:prefix+"assets/assets/pixel.abc123.png",bytes:png}
  ];
}
test("official Expo single-bundle profile is prepared offline with opaque CSP and checked PNG",async()=>{
  const zip=makeZip(expoFiles(),{});
  const result=await buildSupportedWebPreview(zip,"expo.zip");
  assert.equal(result.profile,"expo-metro-single-offline");
  assert.equal(result.indexPath,"dist/index.html");
  assert.equal(result.localAssetCount,1);
  assert.match(result.srcDoc,/Expo ZIP/);
  assert.match(result.srcDoc,/data:image\/png;base64,/);
  assert.doesNotMatch(result.srcDoc,/uri:"\/assets\/assets\//);
  assert.match(result.srcDoc,/default-src 'none'/);
  assert.match(result.srcDoc,/connect-src 'none'/);
  assert.doesNotMatch(result.srcDoc,/allow-same-origin/);
});
test("root-level official Expo Web export is explicitly recognized and prepared",async()=>{
  const zip=makeZip(expoFiles(""));
  const inspection=inspectZip(zip,"root.zip");
  assert.equal(inspection.buildCandidateCount,1);
  assert.equal(inspection.framework,"Expo Web / Metro (kandidat)");
  assert.deepEqual(inspection.buildCandidates,["index.html"]);
  const result=await buildSupportedWebPreview(zip,"root.zip");
  assert.equal(result.indexPath,"index.html");
});
test("GitHub wrapper for Expo dist is handled",async()=>{
  const result=await buildSupportedWebPreview(makeZip(expoFiles("project-main/dist/")));
  assert.equal(result.indexPath,"project-main/dist/index.html");
});
test("two possible HTML entrypoints do not silently choose one",async()=>{
  await assert.rejects(buildSupportedWebPreview(makeZip([...expoFiles(),{
    name:"build/index.html",content:"second"}])),/disa HTML|HTML entrypoints/i);
});
test("tampered PNG internal CRC is rejected even if ZIP CRC has been recalculated",async()=>{
  const damaged=new Uint8Array(png);damaged[47]^=1;
  const files=expoFiles();files[3]={...files[3],bytes:damaged};
  await assert.rejects(buildSupportedWebPreview(makeZip(files)),/PNG Expo.*CRC/);
});
test("internal PNG zlib corruption with recomputed chunk CRC fails closed",async()=>{
  const altered=new Uint8Array(png);
  const view=new DataView(altered.buffer);
  let offset=8,found=false;
  while(offset+12<=altered.length){
    const len=view.getUint32(offset,false);
    const name=String.fromCharCode(...altered.subarray(offset+4,offset+8));
    if(name==="IDAT"){
      altered[offset+8+len-1]^=1; // break Adler32 without breaking PNG chunk framing
      const {crc32}=await import("node:zlib");
      const newCrc=crc32(altered.subarray(offset+4,offset+8+len));
      view.setUint32(offset+8+len,newCrc,false);
      found=true;break;
    }
    offset+=12+len;
  }
  assert.equal(found,true);
  const items=expoFiles();items[3]={...items[3],bytes:altered};
  await assert.rejects(buildSupportedWebPreview(makeZip(items)),/PNG Expo.*IDAT\/zlib/);
});
test("PNG with valid CRC and zlib but invalid scanline filter fails closed",async()=>{
  const {inflateSync,deflateSync,crc32}=await import("node:zlib");
  const original=new Uint8Array(png);
  let start=8;
  while(start<original.length){
    const len=new DataView(original.buffer).getUint32(start,false);
    if(String.fromCharCode(...original.subarray(start+4,start+8))==="IDAT"){
      const inflated=inflateSync(original.subarray(start+8,start+8+len));
      inflated[0]=5; // invalid PNG scanline filter (valid values are 0..4)
      const compressed=deflateSync(inflated);
      const resized=new Uint8Array(original.length-len+compressed.length);
      resized.set(original.subarray(0,start),0);
      resized.set(original.subarray(start+12+len),start+12+compressed.length);
      resized.set([73,68,65,84],start+4);
      resized.set(compressed,start+8);
      const view=new DataView(resized.buffer);
      view.setUint32(start,compressed.length,false);
      view.setUint32(start+8+compressed.length,crc32(resized.subarray(start+4,start+8+compressed.length)),false);
      const items=expoFiles();items[3]={...items[3],bytes:resized};
      await assert.rejects(buildSupportedWebPreview(makeZip(items)),/filter të pavlefshëm/);
      return;
    }
    start+=12+len;
  }
  assert.fail("Fixture does not have an IDAT chunk");
});
test("PNG RGB/RGBA profile rejects untested interlace and color-depth combinations",async()=>{
  const {crc32}=await import("node:zlib");
  for(const [position,newValue] of [[20,1],[16,16],[17,3]]){
    const modified=new Uint8Array(png);modified[8+position]=newValue;
    const view=new DataView(modified.buffer);
    view.setUint32(29,crc32(modified.subarray(12,29)),false);
    const items=expoFiles();items[3]={...items[3],bytes:modified};
    await assert.rejects(buildSupportedWebPreview(makeZip(items)),/RGB\/RGBA 8-bit/);
  }
});
test("Expo rejects an unreferenced PNG, unsupported files, and secret-like files",async()=>{
  for(const more of [
    {name:"dist/assets/assets/orphan.png",bytes:png},
    {name:"dist/.env.production",content:"DO_NOT_EXPOSE=1"},
    {name:"dist/_expo/static/js/web/another.js",content:"console.log('extra')"}
  ]){
    await assert.rejects(buildSupportedWebPreview(makeZip([...expoFiles(),more])),/pambështetur|papërdorura/i);
  }
});
test("Expo fails closed on unknown metadata/unsupported HTML",async()=>{
  const bad=expoFiles();bad[1]={...bad[1],content:'{"version":0,"bundler":"other","fileMetadata":{}}'};
  await assert.rejects(buildSupportedWebPreview(makeZip(bad)),/nuk mbështetet/);
  const multiple=expoFiles();multiple[0]={...multiple[0],content:html+'<script src="https://cdn.example.test/other.js"></script>'};
  await assert.rejects(buildSupportedWebPreview(makeZip(multiple)),/klasik/);
});
test("Vite dynamic-chunk archives are refused rather than showing a broken offline preview",async()=>{
  const files=[
    {name:"dist/index.html",content:'<script type="module" src="/assets/index.js"></script>'},
    {name:"dist/assets/index.js",content:'import("./lazy.js");'},
    {name:"dist/assets/lazy.js",content:"export const ok=true"}
  ];
  await assert.rejects(buildSupportedWebPreview(makeZip(files)),/origin HTTP të izoluar/);
});
test("existing offline one-bundle Vite route is kept",async()=>{
  const result=await buildSupportedWebPreview(makeZip([
    {name:"dist/index.html",content:'<script type="module" src="/assets/index.js"></script>'},
    {name:"dist/assets/index.js",content:"document.getElementById('root').textContent='LEGACY-VITE';"}
  ]));
  assert.match(result.srcDoc,/LEGACY-VITE/);
});
