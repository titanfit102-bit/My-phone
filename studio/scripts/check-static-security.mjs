// Zero-dependency high-confidence checks on tracked repository content.
// This complements (not replaces) npm advisory audit, runtime Playwright or
// GitHub-native secret protection. Only sanitized rule IDs and paths are logged.
import {readFileSync,statSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {resolve,relative} from "node:path";
import {fileURLToPath} from "node:url";

const repoRoot=resolve(fileURLToPath(import.meta.url),"../../..");
const MAX_TRACKED_BYTES=2*1024*1024;
export const STRICT_ZIP_SANDBOX="allow-scripts";
export const CSP_REQUIRED=[
  "default-src 'none'", "connect-src 'none'", "frame-src 'none'",
  "worker-src 'none'", "form-action 'none'", "base-uri 'none'",
  "object-src 'none'"
];

// Intentionally high-confidence signatures: no entropy-only heuristics that
// flag random tests or hashes. Do not print matched text or secrets.
const TOKENS=[
  {id:"github-classic-token",pattern:/\bgh[pousr]_[A-Za-z0-9]{30,}\b/g},
  {id:"github-fine-grained-token",pattern:/\bgithub_pat_[A-Za-z0-9_]{24,}\b/g},
  {id:"aws-access-key",pattern:/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g},
  {id:"slack-access-token",pattern:/\bxox[baprs]-[A-Za-z0-9-]{24,}\b/g},
  {id:"private-key-material",pattern:/-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g},
  {id:"credential-bearing-url",pattern:/https?:\/\/[^\s/'"@:<>{}]+:[^\s/'"@<>{}]+@[^\s/'"@<>{}]+/g}
];
const EXECUTION=[
  {id:"dynamic-eval",pattern:/\beval\s*\(/g},
  {id:"dynamic-function-constructor",pattern:/\bnew\s+Function\s*\(/g},
  {id:"react-raw-html",pattern:/\bdangerouslySetInnerHTML\b/g}
];

function lineOf(content,index) {
  let n=1;
  for(let i=0;i<index;i++)if(content.charCodeAt(i)===10)n++;
  return n;
}
function isSyntheticCredentialFixture(path,value){
  if(!/^studio\\/tests\\/[^/]+\\.test\\.mjs$/.test(path))return false;
  try{
    const url=new URL(value);
    const shortFakeUser=["u","user"].includes(url.username);
    const shortFakePassword=["p","pw","pass","secret"].includes(url.password);
    return shortFakeUser&&shortFakePassword&&
      (url.hostname.endsWith(".test")||url.hostname==="github.com");
  }catch{return false;}
}
export function scanText(path,content) {
  const findings=[];
  for(const rule of TOKENS){
    for(const m of content.matchAll(rule.pattern)){
      if(rule.id==="credential-bearing-url"&&isSyntheticCredentialFixture(path,m[0]))
        continue; // Exact intentionally-invalid URL fixtures, no general test bypass.
      findings.push({file:path,line:lineOf(content,m.index),rule:rule.id});
    }
  }
  // These are runtime sources, not test fixtures, documentation or scanner
  // implementation. A finding is a review blocker, not proof of exploitation.
  if(path==="studio/App.tsx"||path.startsWith("studio/src/")||
     path.startsWith("templates/")){
    for(const rule of EXECUTION){
      for(const m of content.matchAll(rule.pattern))
        findings.push({file:path,line:lineOf(content,m.index),rule:rule.id});
    }
  }
  return findings;
}

export function verifyPreviewBoundary(app,quickPreview) {
  const findings=[];
  // Only SRC-DOC Quick Preview is required to have an opaque origin.
  // External HTTPS/Appetize iframe hosts may use separate sandbox policies.
  const embedded=app.match(/<iframe\b[^>]*\bsrcDoc=\{quickPreview\.srcDoc\}[^>]*\bsandbox="([^"]+)"/s);
  if(!embedded || embedded[1].trim()!==STRICT_ZIP_SANDBOX)
    findings.push({file:"studio/App.tsx",line:1,rule:"zip-iframe-sandbox-invariant"});
  const policies=[...quickPreview.matchAll(/\bconst policy="([^"]+)"/g)];
  if(policies.length!==2||policies.some(([,policy])=>CSP_REQUIRED.some(term=>!policy.includes(term))))
    findings.push({file:"studio/src/quick-preview.js",line:1,rule:"zip-csp-invariant"});
  return findings;
}

export function scanRepository(root) {
  const listing=spawnSync("git",["ls-files","-z","--cached"],{
    cwd:root,encoding:"utf8",maxBuffer:8*1024*1024,timeout:20000
  });
  if(listing.error||listing.status!==0||!listing.stdout)
    throw Error("Cannot enumerate tracked Git files; fail closed.");
  const files=listing.stdout.split("\0").filter(Boolean);
  const findings=[];
  for(const file of files){
    const absolute=resolve(root,file);
    if(relative(root,absolute).startsWith(".."))
      throw Error("Tracked path escaped repository.");
    const bytes=statSync(absolute).size;
    if(bytes>MAX_TRACKED_BYTES){
      findings.push({file,line:1,rule:"oversize-file-not-inspected"});
      continue;
    }
    const content=readFileSync(absolute,"utf8");
    if(content.includes("\0")){
      // Binary files are not source, but do not silently skip untrusted executable
      // files masquerading as text.
      if(/\.(?:js|mjs|cjs|jsx|ts|tsx|json|yml|yaml|md)$/.test(file))
        findings.push({file,line:1,rule:"binary-file-in-source"});
      continue;
    }
    findings.push(...scanText(file,content));
  }
  const app=readFileSync(resolve(root,"studio/App.tsx"),"utf8");
  const preview=readFileSync(resolve(root,"studio/src/quick-preview.js"),"utf8");
  findings.push(...verifyPreviewBoundary(app,preview));
  return {filesScanned:files.length,findings};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const outcome=scanRepository(repoRoot);
    for(const finding of outcome.findings)
      console.error(`SECURITY BLOCK: ${finding.rule} at ${finding.file}:${finding.line} (value hidden)`);
    console.log(`Static security: ${outcome.filesScanned} tracked files reviewed; ${outcome.findings.length} blocking findings.`);
    if(outcome.findings.length)process.exitCode=1;
  }catch(error){
    console.error("Static security FAILED CLOSED:",error.message);
    process.exitCode=1;
  }
}
