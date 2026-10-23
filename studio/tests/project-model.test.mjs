import test from "node:test";
import assert from "node:assert/strict";
import {
  cleanGithubUrl, cleanWebUrl, cleanAppetizeEmbed,
  newProject, loadProjects, chooseMode, freshWebUrl, MAX_WEB_URL_BYTES, utf8ByteLength
} from "../src/project-model.js";

test("validate GitHub repository and reject injected paths", () => {
  assert.equal(cleanGithubUrl("https://github.com/titanfit102-bit/Illyrian.git"), "https://github.com/titanfit102-bit/Illyrian");
  for(const url of ["https://github.com.evil.tld/a/b", "https://github.com/a/b/tree/main",
    "http://github.com/a/b", "https://github.com/a/b?token=secret", "javascript:alert(1)",
    "https://u:p@github.com/a/b"]) assert.throws(() => cleanGithubUrl(url));
});
test("web allows HTTPS only; native is Appetize embed only", () => {
  assert.equal(cleanWebUrl("https://illyrian-demo.vercel.app"), "https://illyrian-demo.vercel.app/");
  assert.equal(cleanAppetizeEmbed("https://appetize.io/embed/abc12345"), "https://appetize.io/embed/abc12345");
  for (const url of ["http://example.com", "https://site.test/#abc", "https://user:pass@host.test"]) assert.throws(() => cleanWebUrl(url));
  for (const url of ["https://appetize.io/app/abc12345", "https://evil.test/embed/abc12345",
    "https://appetize.io/embed/abc12345?apiKey=secret", "https://appetize.io/embed/abc"]) assert.throws(() => cleanAppetizeEmbed(url));
});
test("create web/native linked project and choose available mode", () => {
  const p = newProject({name:" ILLYRIAN ",github:"https://github.com/a/illyrian",web:"https://ily.example.org",native:""}, "project-123");
  assert.equal(p.name,"ILLYRIAN");
  assert.equal(chooseMode(p,"native"),"web");
  assert.equal(freshWebUrl(p.web, 7),"https://ily.example.org/?myphone_refresh=7");
  const n = newProject({name:"Native",github:"https://github.com/a/app",web:"",native:"https://appetize.io/embed/abc12345"},"project-456");
  assert.equal(chooseMode(n,"web"),"native");
  assert.throws(()=>newProject({name:"Empty",github:"https://github.com/a/b",web:"",native:""}, "project-456"));
});
test("malformed and duplicate storage entries are ignored", () => {
  const p=newProject({name:"A",github:"https://github.com/a/b",web:"https://a.vercel.app",native:""},"project-123");
  assert.equal(loadProjects(JSON.stringify([p,p,{bad:true}])).length,1);
  assert.deepEqual(loadProjects("{oops"),[]);
});

test("A07: UTF-8 budget counts Unicode codepoints, including replacement for lone surrogate",()=>{
  for (const text of ["ascii", "é", "😀", "a😀é", "\ud800"]) {
    assert.equal(utf8ByteLength(text),new TextEncoder().encode(text).length);
  }
});
test("A07: HTTPS preview URL is capped at 8192 normalized bytes",()=>{
  const prefix="https://example.test/?q=";
  const exact=prefix+"a".repeat(MAX_WEB_URL_BYTES-prefix.length);
  assert.equal(cleanWebUrl(exact),exact);
  assert.equal(utf8ByteLength(cleanWebUrl(exact)),MAX_WEB_URL_BYTES);
  assert.throws(()=>cleanWebUrl(exact+"a"),/8192 byte/);
  assert.throws(()=>cleanWebUrl(prefix+"😀".repeat(1000)+"a".repeat(5000)),/8192 byte/);
});
