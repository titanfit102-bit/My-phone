import test from "node:test";
import assert from "node:assert/strict";
import {scanText,verifyPreviewBoundary,CSP_REQUIRED,trackedFileRule} from "../scripts/check-static-security.mjs";

const noFindings=value=>assert.deepEqual(value,[]);
const ruleNames=value=>value.map(x=>x.rule);

test("SEC-09: synthetic GitHub, AWS and private-key secrets trigger redacted findings",()=>{
  const content=[
    "const token = '"+("gh"+"p_")+"A".repeat(36)+"';",
    "const aws = '"+("AK"+"IA")+"X".repeat(16)+"';",
    "const key = '"+("-----BEGIN "+"PRIVATE KEY-----")+"';"
  ].join("\n");
  const issues=scanText("studio/src/synthetic.tsx",content);
  assert.deepEqual(ruleNames(issues),
    ["github-classic-token","aws-access-key","private-key-material"]);
  assert.deepEqual(issues.map(x=>x.line),[1,2,3]);
  assert.ok(!JSON.stringify(issues).includes("A".repeat(36)),
    "Never print matched credential values");
});

test("SEC-09: fine-grained tokens and credential-bearing URLs are rejected",()=>{
  const content=[
    "export const id = '"+("github_"+"pat_")+"a".repeat(30)+"';",
    "export const api = 'https://user:pass"+"@example.test/v1';"
  ].join("\n");
  const issues=scanText("studio/src/example.js",content);
  assert.deepEqual(ruleNames(issues),
    ["github-fine-grained-token","credential-bearing-url"]);
});

test("SEC-09: exact negative-test URL fixtures only, no broad test-folder bypass",()=>{
  noFindings(scanText("studio/tests/project-model.test.mjs",
    'assert.rejects("https://u:p@github.com/example/demo");'));
  noFindings(scanText("studio/tests/live-sync.test.mjs",
    'assert.rejects("https://user:pw@myapp.test");'));
  assert.deepEqual(ruleNames(scanText("studio/tests/project-model.test.mjs",
    'const leaked="https://bob:actualpass'+'@production.example.org";')),
    ["credential-bearing-url"]);
  assert.deepEqual(ruleNames(scanText("studio/tests/project-model.test.mjs",
    'const leaked="'+("gh"+"p_")+"A".repeat(35)+'";')),
    ["github-classic-token"]);
});

test("SEC-09: harmless placeholders, hashes and dependency text pass",()=>{
  noFindings(scanText("studio/src/example.js",
    "const url='https://preview.example.test'; const key='REPLACE_ME';\n"+
    "const sha='0123456789abcdef0123456789abcdef';"));
  noFindings(scanText("studio/tests/example.test.mjs",
    "const x = 'eval(' + 'unsafe'; // runtime code checks exclude fixtures"));
});

test("SEC-09: source evaluation and dangerous raw HTML block, docs do not trigger SAST",()=>{
  const dangerous=[
    "const result = "+("ev"+"al")+"(userCode);",
    "const fn = new"+" Function('return 1');",
    "const view = {"+("dangerously"+"SetInnerHTML")+":{__html:external}};"
  ].join("\n");
  assert.deepEqual(ruleNames(scanText("studio/src/unsafe.js",dangerous)),
    ["dynamic-eval","dynamic-function-constructor","react-raw-html"]);
  noFindings(scanText("docs/THREAT_MODEL.md",dangerous));
});

const app=sandbox=>`<iframe key="zip" srcDoc={quickPreview.srcDoc} sandbox="${sandbox}"/>`;
const policies=extra=>[1,2].map(()=>`const policy="${CSP_REQUIRED.join("; ")}${extra}";`).join("\n");

test("SEC-09: symlinks, directories and oversized tracked files fail closed",()=>{
  const stat=(kind,size=200)=>({
    isSymbolicLink:()=>kind==="symlink",isFile:()=>kind==="file",size
  });
  assert.equal(trackedFileRule(stat("file")),null);
  assert.equal(trackedFileRule(stat("symlink")),"symlink-not-inspected");
  assert.equal(trackedFileRule(stat("directory")),"non-regular-tracked-file");
  assert.equal(trackedFileRule(stat("file",3*1024*1024)),"oversize-file-not-inspected");
});

test("SEC-04: opaque Quick Preview and two strict CSP definitions are required",()=>{
  noFindings(verifyPreviewBoundary(app("allow-scripts"),policies("")));
  assert.deepEqual(ruleNames(verifyPreviewBoundary(app("allow-scripts allow-same-origin"),policies(""))),
    ["zip-iframe-sandbox-invariant"]);
  assert.deepEqual(ruleNames(verifyPreviewBoundary(app("allow-scripts allow-popups"),policies(""))),
    ["zip-iframe-sandbox-invariant"]);
  assert.deepEqual(ruleNames(verifyPreviewBoundary(app("allow-scripts"),policies("").replaceAll("worker-src 'none'","worker-src *"))),
    ["zip-csp-invariant"]);
  assert.deepEqual(ruleNames(verifyPreviewBoundary(app("allow-scripts"),'const policy="default-src *";')),
    ["zip-csp-invariant"]);
});
