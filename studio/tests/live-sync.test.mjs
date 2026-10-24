import test from "node:test";
import assert from "node:assert/strict";
import {
  manifestUrl, parseManifest, readBoundedManifestText, transitionSync, initialSyncState, applyPendingSync, summarizeSync,
  SYNC_POLL_MS, FALLBACK_REFRESH_MS
} from "../src/live-sync.js";

test("metadata URL targets application deployment without tokens", () => {
  const url = new URL(manifestUrl("https://myapp.vercel.app/profile?a=1"));
  assert.equal(url.origin, "https://myapp.vercel.app");
  assert.equal(url.pathname, "/build-info.json");
  assert.ok(url.searchParams.has("myphone_check"));
  assert.throws(() => manifestUrl("http://example.test"));
  assert.throws(() => manifestUrl("https://user:pw@myapp.test"));
});
test("reject invalid and hostile manifests", () => {
  for (const v of [null, [], {}, {revision: 12}, {revision: "<script>"}, {revision: ""}, {revision: "a".repeat(129)}])
    assert.equal(parseManifest(v), null);
  assert.deepEqual(parseManifest({revision:"a1b2c3",builtAt:"2026-10-20T20:00:00.000Z"}),
    {revision:"a1b2c3",builtAt:"2026-10-20T20:00:00.000Z",fingerprint:"a1b2c3|2026-10-20T20:00:00.000Z"});
});
test("first verified version does not reload twice and unchanged revisions are stable", () => {
  const manifest = parseManifest({revision:"first"});
  const one=transitionSync(initialSyncState(),{kind:"published",manifest},100);
  assert.equal(one.reload,false);
  assert.equal(one.state.phase,"published");
  const two=transitionSync(one.state,{kind:"published",manifest},200);
  assert.equal(two.reload,false);
  assert.equal(two.state.checkedAt,200);
});
test("only a newly published fingerprint triggers a reload", () => {
  const first=transitionSync(initialSyncState(),{kind:"published",manifest:parseManifest({revision:"first"})},100);
  const next=transitionSync(first.state,{kind:"published",manifest:parseManifest({revision:"second"})},300);
  assert.equal(next.reload,true);
  assert.equal(next.state.revision,"second");
  assert.equal(next.state.changedAt,300);
  assert.equal(transitionSync(next.state,{kind:"published",manifest:parseManifest({revision:"second"})},400).reload,false);
});
test("failed, forbidden and missing metadata never claim success", () => {
  const base=transitionSync(initialSyncState(),{kind:"published",manifest:parseManifest({revision:"abc"})},100).state;
  for(const kind of ["unreachable","unsupported","restricted"]) {
    const out=transitionSync(base,{kind},200);
    assert.equal(out.reload,false);
    assert.notEqual(out.state.phase,"published");
    assert.equal(out.state.revision,"abc"); // last known, not a newly confirmed build
    assert.equal(summarizeSync(out.state).ok,false);
  }
  assert.ok(FALLBACK_REFRESH_MS>SYNC_POLL_MS);
});

test("Session Freeze preserves a visible reference and holds updates until explicit apply", () => {
  const outcome = revision => ({kind:"published",manifest:parseManifest({revision})});
  const first=transitionSync(initialSyncState(),outcome("alpha"),100).state;
  assert.equal(first.displayedRevision,"alpha");
  const frozen=transitionSync(first,outcome("beta"),200,{frozen:true});
  assert.equal(frozen.reload,false);
  assert.equal(frozen.state.revision,"beta");
  assert.equal(frozen.state.displayedRevision,"alpha");
  assert.equal(frozen.state.pendingRevision,"beta");
  const unchanged=transitionSync(frozen.state,outcome("beta"),300,{frozen:true});
  assert.equal(unchanged.reload,false);
  assert.equal(unchanged.state.pendingRevision,"beta");
  const applied=applyPendingSync(unchanged.state);
  assert.equal(applied.reload,true);
  assert.equal(applied.state.displayedRevision,"beta");
  assert.equal(applied.state.pendingRevision,null);
  assert.equal(applyPendingSync(applied.state).reload,false);
  assert.equal(transitionSync(applied.state,outcome("beta"),400,{frozen:true}).reload,false);
});
test("Session Freeze observes the latest of multiple releases and drops a rolled-back pending version",()=>{
  const o=revision=>({kind:"published",manifest:parseManifest({revision})});
  const first=transitionSync(initialSyncState(),o("alpha"),100).state;
  const beta=transitionSync(first,o("beta"),200,{frozen:true}).state;
  const gamma=transitionSync(beta,o("gamma"),300,{frozen:true}).state;
  assert.equal(gamma.displayedRevision,"alpha");
  assert.equal(gamma.pendingRevision,"gamma");
  const restored=transitionSync(gamma,o("alpha"),400,{frozen:true});
  assert.equal(restored.reload,false);
  assert.equal(restored.state.pendingRevision,null);
  assert.equal(restored.state.displayedRevision,"alpha");
});
test("Switching from Session Freeze to automatic mode applies exactly one queued release",()=>{
  const o=revision=>({kind:"published",manifest:parseManifest({revision})});
  const first=transitionSync(initialSyncState(),o("a"),100).state;
  const frozen=transitionSync(first,o("b"),200,{frozen:true}).state;
  const auto=transitionSync(frozen,o("b"),300,{frozen:false});
  assert.equal(auto.reload,true);
  assert.equal(auto.state.displayedRevision,"b");
  assert.equal(auto.state.pendingRevision,null);
  assert.equal(transitionSync(auto.state,o("b"),400,{frozen:false}).reload,false);
});
test("Network and authorization failures never force a frozen pending deployment",()=>{
  const o=revision=>({kind:"published",manifest:parseManifest({revision})});
  const first=transitionSync(initialSyncState(),o("a"),100).state;
  const frozen=transitionSync(first,o("b"),200,{frozen:true}).state;
  for (const kind of ["unreachable","unsupported","restricted"]) {
    const failed=transitionSync(frozen,{kind},300,{frozen:true});
    assert.equal(failed.reload,false);
    assert.equal(failed.state.pendingRevision,"b");
    assert.equal(failed.state.displayedRevision,"a");
  }
});

const utf8 = text => new TextEncoder().encode(text);
const streamResponse = (chunks, header=null) => {
  let reads=0, cancelled=0;
  const reader={
    async read(){reads++;return chunks.length?{value:chunks.shift(),done:false}:{done:true}},
    async cancel(){cancelled++},
    releaseLock(){}
  };
  return {
    response:{headers:{get:()=>header},body:{getReader:()=>reader,async cancel(){cancelled++}}},
    get reads(){return reads},get cancelled(){return cancelled}
  };
};
test("bounded manifest reader: exact 16384 UTF-8 bytes accepted, even with split codepoints",async()=>{
  const body="a".repeat(16380)+"😀";
  assert.equal(utf8(body).byteLength,16384);
  const bytes=utf8(body);
  const mock=streamResponse([bytes.slice(0,16382),bytes.slice(16382)],null);
  assert.equal(await readBoundedManifestText(mock.response),body);
  assert.equal(mock.cancelled,0);
});
test("bounded reader cancels at first oversized chunk and never reads remaining stream",async()=>{
  const mock=streamResponse([utf8("a".repeat(8000)),utf8("b".repeat(9000)),utf8("should-not-read")]);
  assert.equal(await readBoundedManifestText(mock.response),null);
  assert.equal(mock.cancelled,1);
  assert.equal(mock.reads,2);
});
test("unknown/misleading Content-Length cannot bypass the actual byte cap",async()=>{
  for(const header of [null,"8","not-a-number","-1"]){
    const mock=streamResponse([utf8("a".repeat(16000)),utf8("b".repeat(400))],header);
    assert.equal(await readBoundedManifestText(mock.response),null);
    assert.equal(mock.cancelled,1);
  }
});
test("oversized declared length aborts network AND cancels unread body without reading",async()=>{
  const mock=streamResponse([utf8('{"revision":"valid"}')],"16385");
  const abort=new AbortController();
  let aborts=0;
  abort.signal.addEventListener("abort",()=>{aborts++});
  assert.equal(await readBoundedManifestText(mock.response,16384,abort),null);
  assert.equal(mock.reads,0);
  assert.equal(mock.cancelled,1);
  assert.equal(aborts,1);
  assert.equal(abort.signal.aborted,true);
});

test("declared huge integer is rejected before allocating a body; malformed length is streamed safely",async()=>{
  const giant=streamResponse([utf8("unread")],"999999999999999999999999999999999999");
  const abort=new AbortController();
  assert.equal(await readBoundedManifestText(giant.response,16384,abort),null);
  assert.equal(giant.reads,0);
  assert.equal(giant.cancelled,1);
  assert.equal(abort.signal.aborted,true);
  const malformed=streamResponse([utf8('{"revision":"good"}')],"not-numeric");
  const accepted=new AbortController();
  assert.equal(await readBoundedManifestText(malformed.response,16384,accepted),'{"revision":"good"}');
  assert.equal(accepted.signal.aborted,false);
  assert.equal(malformed.cancelled,0);
});

test("streamed oversize aborts network, cancels locked reader, never consumes later chunks",async()=>{
  const mock=streamResponse([utf8("a".repeat(14000)),utf8("b".repeat(2600)),utf8("never-read")]);
  const abort=new AbortController();
  assert.equal(await readBoundedManifestText(mock.response,16384,abort),null);
  assert.equal(abort.signal.aborted,true);
  assert.equal(mock.reads,2);
  assert.equal(mock.cancelled,1);
});

test("non-streaming response fails closed and aborts request without response.text()",async()=>{
  const abort=new AbortController();
  let textCalls=0;
  const response={headers:{get:()=>null},body:null,text:async()=>{textCalls++;return "{}"}};
  assert.equal(await readBoundedManifestText(response,16384,abort),null);
  assert.equal(abort.signal.aborted,true);
  assert.equal(textCalls,0);
});
test("UTF-8 multibyte manifest bound is based on bytes, not JS characters",async()=>{
  const text="😀".repeat(4097);
  assert.ok(text.length<=16384);
  assert.ok(utf8(text).byteLength>16384);
  const mock=streamResponse([utf8(text)]);
  assert.equal(await readBoundedManifestText(mock.response),null);
  assert.equal(mock.cancelled,1);
});
test("reader refuses non-streaming responses rather than buffering response.text()",async()=>{
  let textCalled=false;
  const response={headers:{get:()=>null},body:null,text:async()=>{textCalled=true;return "unbounded"}};
  assert.equal(await readBoundedManifestText(response),null);
  assert.equal(textCalled,false);
});
test("reader propagates aborted stream and cancels without publishing a revision",async()=>{
  let cancelled=false,released=false;
  const reader={
    read:async()=>{const e=new Error("request aborted");e.name="AbortError";throw e},
    cancel:async()=>{cancelled=true},
    releaseLock:()=>{released=true}
  };
  const response={headers:{get:()=>null},body:{getReader:()=>reader}};
  await assert.rejects(readBoundedManifestText(response),{name:"AbortError"});
  assert.equal(cancelled,true);assert.equal(released,true);
});
test("reader validates successful streaming JSON and propagates invalid UTF-8",async()=>{
  const value='{"revision":"build-ok","builtAt":"2026-10-23T18:00:00Z"}';
  const good=streamResponse([utf8(value).slice(0,8),utf8(value).slice(8)],null);
  assert.equal(parseManifest(JSON.parse(await readBoundedManifestText(good.response))).revision,"build-ok");
  const bad=streamResponse([new Uint8Array([0xc3,0x28])],null);
  await assert.rejects(readBoundedManifestText(bad.response),/encoded|valid|UTF-8/i);
});
