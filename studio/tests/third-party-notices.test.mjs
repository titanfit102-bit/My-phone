import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {resolve, dirname} from "node:path";
import {spawnSync} from "node:child_process";
import {createHash} from "node:crypto";

const script = resolve(import.meta.dirname, "../scripts/emit-third-party-notices.mjs");
function fixture(t) {
  const root = mkdtempSync(resolve(tmpdir(), "studio-notices-"));
  t.after(() => rmSync(root, {recursive:true, force:true}));
  const output = resolve(root, "export");
  mkdirSync(output);
  const put = (path, value) => {
    const target = resolve(root, path);
    mkdirSync(dirname(target), {recursive:true});
    writeFileSync(target, typeof value === "string" ? value : JSON.stringify(value));
  };
  const pkg = (path="node_modules/demo", version="1.0.0") => {
    put(path+"/package.json", {name:"demo", version, license:"MIT"});
    put(path+"/index.js", "export default 1;");
  };
  const map = (sources, file="export/app.js.map") => put(file, {version:3, sources, names:[], mappings:""});
  const run = () => spawnSync(process.execPath, [script, root, output], {encoding:"utf8"});
  return {root, output, put, pkg, map, run};
}

test("export notices include exact license and NOTICE text for bundled packages only", t => {
  const f=fixture(t); f.pkg(); f.pkg("node_modules/not-bundled");
  f.put("node_modules/demo/LICENSE", "Copyright Example\nFull permission text for fixture.\n");
  f.put("node_modules/demo/NOTICE", "Additional attribution.\n");
  f.map(["__prelude__", "/App.tsx", "/node_modules/demo/index.js"]);
  const result=f.run(); assert.equal(result.status,0,result.stderr);
  const text=readFileSync(resolve(f.output,"THIRD_PARTY_NOTICES.txt"),"utf8");
  assert.match(text,/demo@1\.0\.0/);
  assert.ok(text.includes("Copyright Example\nFull permission text for fixture.\n"));
  assert.ok(text.includes("Additional attribution.\n"));
  assert.doesNotMatch(text,/not-bundled|studio-notices-/);
});

test("missing license text fails closed even when package.json says MIT", t => {
  const f=fixture(t); f.pkg(); f.map(["/node_modules/demo/index.js"]);
  const result=f.run(); assert.notEqual(result.status,0);
  assert.match(result.stderr,/Missing license text.*demo@1\.0\.0/);
});

test("NOTICE alone and blank LICENSE do not satisfy license coverage", t => {
  const f=fixture(t); f.pkg(); f.put("node_modules/demo/LICENSE","  \n");
  f.put("node_modules/demo/NOTICE","Attribution only"); f.map(["/node_modules/demo/index.js"]);
  const result=f.run(); assert.notEqual(result.status,0);
  assert.match(result.stderr,/Missing license text/);
});

test("missing source maps fail instead of emitting incomplete notices", t => {
  const result=fixture(t).run(); assert.notEqual(result.status,0);
  assert.match(result.stderr,/No source maps/);
});

test("maps without any dependency sources fail coverage", t => {
  const f=fixture(t); f.map(["__prelude__", "/App.tsx"]);
  const result=f.run(); assert.notEqual(result.status,0);
  assert.match(result.stderr,/No bundled dependency packages/);
});

test("unresolvable bundled dependency fails coverage", t => {
  const f=fixture(t); f.map(["/node_modules/missing/index.js"]);
  const result=f.run(); assert.notEqual(result.status,0);
  assert.match(result.stderr,/Cannot resolve bundled source/);
});

test("nested versions and package.json files without names resolve to owning package", t => {
  const f=fixture(t); f.pkg(); f.pkg("node_modules/outer/node_modules/demo","2.0.0");
  for (const path of ["node_modules/demo","node_modules/outer/node_modules/demo"])
    f.put(path+"/LICENSE", "Permission for "+path+"\n");
  f.put("node_modules/demo/helpers/package.json", {type:"module"});
  f.put("node_modules/demo/helpers/helper.js", "export default 1;");
  f.map(["/node_modules/demo/index.js", "/node_modules/demo/helpers/helper.js"]);
  f.map(["/node_modules/outer/node_modules/demo/index.js"],"export/chunk.js.map");
  const result=f.run(); assert.equal(result.status,0,result.stderr);
  const text=readFileSync(resolve(f.output,"THIRD_PARTY_NOTICES.txt"),"utf8");
  assert.equal(text.split("Package: demo@1.0.0").length-1,1);
  assert.equal(text.split("Package: demo@2.0.0").length-1,1);
});

test("indexed source maps include dependency licenses from every section", t => {
  const f=fixture(t); f.pkg(); f.put("node_modules/demo/license.md","Permission fixture\n");
  f.put("export/app.js.map", {version:3,sections:[{offset:{line:0,column:0},map:{version:3,sources:["/node_modules/demo/index.js"]}}]});
  const result=f.run(); assert.equal(result.status,0,result.stderr);
  assert.match(readFileSync(resolve(f.output,"THIRD_PARTY_NOTICES.txt"),"utf8"),/Permission fixture/);
});

test("dependency paths cannot escape installed node_modules", t => {
  const f=fixture(t); f.map(["/node_modules/../../private/index.js"]);
  const result=f.run(); assert.notEqual(result.status,0);
  assert.match(result.stderr,/outside node_modules/);
});

function fallback(f) {
  const text="Upstream permission and copyright\n";
  f.put("licenses/upstream.txt",text);
  f.put("licenses/upstream-license-sources.json", {"demo@1.0.0":{
    file:"upstream.txt",license:"MIT",source:"https://example.invalid/upstream/commit/LICENSE",
    sha256:createHash("sha256").update(text).digest("hex")
  }});
}

test("reviewed upstream fallback includes its complete text and provenance", t => {
  const f=fixture(t); f.pkg(); f.map(["/node_modules/demo/index.js"]); fallback(f);
  const result=f.run(); assert.equal(result.status,0,result.stderr);
  const text=readFileSync(resolve(f.output,"THIRD_PARTY_NOTICES.txt"),"utf8");
  assert.match(text,/Upstream permission and copyright/);
  assert.match(text,/https:\/\/example\.invalid\/upstream\/commit\/LICENSE/);
});

test("upstream fallback rejects tampering instead of silently shipping changed license text", t => {
  const f=fixture(t); f.pkg(); f.map(["/node_modules/demo/index.js"]); fallback(f);
  f.put("licenses/upstream.txt","Changed text");
  const result=f.run(); assert.notEqual(result.status,0);
  assert.match(result.stderr,/Upstream license digest mismatch/);
});

test("upstream fallback is pinned to the reviewed package version", t => {
  const f=fixture(t); f.pkg("node_modules/demo","2.0.0"); f.map(["/node_modules/demo/index.js"]); fallback(f);
  const result=f.run(); assert.notEqual(result.status,0);
  assert.match(result.stderr,/Missing license text.*demo@2\.0\.0/);
});

test("nonempty sourceRoot cannot hide an unlicensed dependency alongside a covered package", t => {
  const f=fixture(t); f.pkg(); f.pkg("node_modules/omitted");
  f.put("node_modules/demo/LICENSE","Complete fixture permission\n");
  f.map(["/node_modules/demo/index.js"]);
  f.put("export/chunk.js.map",{version:3,sourceRoot:"node_modules/omitted/",sources:["index.js"]});
  const result=f.run(); assert.notEqual(result.status,0);
  assert.match(result.stderr,/sourceRoot/);
});

test("sourceRoot is also rejected inside indexed map sections", t => {
  const f=fixture(t); f.pkg(); f.put("node_modules/demo/LICENSE","Complete fixture permission\n");
  f.map(["/node_modules/demo/index.js"]);
  f.put("export/chunk.js.map",{version:3,sections:[{offset:{line:0,column:0},map:{
    version:3,sourceRoot:"node_modules/omitted/",sources:["index.js"]
  }}]});
  const result=f.run(); assert.notEqual(result.status,0);
  assert.match(result.stderr,/sourceRoot/);
});

test("an additional JavaScript chunk without its own map fails coverage", t => {
  const f=fixture(t); f.pkg(); f.put("node_modules/demo/LICENSE","Complete fixture permission\n");
  f.map(["/node_modules/demo/index.js"]); f.put("export/extra.js","console.log(1);");
  const result=f.run(); assert.notEqual(result.status,0);
  assert.match(result.stderr,/Missing source map.*extra\.js/);
});
