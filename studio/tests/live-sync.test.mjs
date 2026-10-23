import test from "node:test";
import assert from "node:assert/strict";
import {
  manifestUrl, parseManifest, readBoundedManifestBody, transitionSync, initialSyncState, applyPendingSync, summarizeSync,
  SYNC_POLL_MS, FALLBACK_REFRESH_MS, MAX_MANIFEST_BYTES
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
const jsonBody = count => '{"revision":"safe","padding":"' + "a".repeat(count) + '"}';

test("A02: exactly 16384 UTF-8 bytes are accepted; 16385 are rejected", async () => {
  const prefix = jsonBody(0);
  const full = jsonBody(MAX_MANIFEST_BYTES - utf8(prefix).length);
  assert.equal(utf8(full).length, MAX_MANIFEST_BYTES);
  const good = await readBoundedManifestBody(new Response(full), new AbortController());
  assert.equal(good, full);
  assert.equal(parseManifest(JSON.parse(good)).revision, "safe");

  const aborted = new AbortController();
  const oversized = await readBoundedManifestBody(
    new Response(full + "x", {headers: {"content-length": "1"}}), aborted);
  assert.equal(oversized, null);
  assert.equal(aborted.signal.aborted, true);
});

test("A02: chunked body without Content-Length stops on first oversized chunk and cancels", async () => {
  let cancelled = false, pulled = 0;
  const source = new ReadableStream({
    pull(controller) {
      pulled++;
      if (pulled === 1) controller.enqueue(new Uint8Array(8192));
      else if (pulled === 2) controller.enqueue(new Uint8Array(8193));
      else throw Error("The reader consumed bytes after the 16KiB cap");
    },
    cancel() {cancelled = true;}
  }, {highWaterMark: 0});
  const abort = new AbortController();
  const result = await readBoundedManifestBody(new Response(source), abort);
  assert.equal(result, null);
  assert.equal(abort.signal.aborted, true);
  assert.equal(cancelled, true);
  assert.equal(pulled, 2);
});

test("A02: a misleading small Content-Length cannot bypass the actual byte cap", async () => {
  const bytes = utf8("a".repeat(MAX_MANIFEST_BYTES + 1));
  let cancelled = false;
  const stream = new ReadableStream({
    start(ctrl) {ctrl.enqueue(bytes);},
    cancel(){cancelled=true;}
  }, {highWaterMark: 0});
  const abort = new AbortController();
  const body = await readBoundedManifestBody(
    new Response(stream,{headers:{"content-length":"8"}}),abort);
  assert.equal(body,null);
  assert.equal(abort.signal.aborted,true);
  assert.equal(cancelled,true);
});

test("A02: an advertised oversize or malformed Content-Length is denied before reading", async () => {
  for (const length of [String(MAX_MANIFEST_BYTES + 1), "not-a-number", "9999999999999999999"]) {
    let pulled = 0;
    const body = new ReadableStream({pull(){pulled++;}}, {highWaterMark: 0});
    const controller = new AbortController();
    assert.equal(await readBoundedManifestBody(new Response(body,{headers:{"content-length":length}}),controller),null);
    assert.equal(controller.signal.aborted,true);
    assert.equal(pulled,0);
  }
});

test("A02: multi-byte UTF-8 must count bytes, not JS string characters", async () => {
  const shell=jsonBody(0),overhead=utf8(shell).length;
  const bytesLeft=MAX_MANIFEST_BYTES-overhead;
  const exact='{"revision":"safe","padding":"' + "é".repeat(bytesLeft / 2) + '"}';
  assert.equal(utf8(exact).length,MAX_MANIFEST_BYTES);
  assert.equal(await readBoundedManifestBody(new Response(exact),new AbortController()),exact);
  const controller=new AbortController();
  assert.equal(await readBoundedManifestBody(new Response(exact.replace('"padding":"','"padding":"é')),controller),null);
  assert.equal(controller.signal.aborted,true);
  assert.equal(await readBoundedManifestBody(new Response(new Uint8Array([0x7b,0x80,0x7d])),new AbortController()),null);
});

test("A02: missing streaming body fails closed; abort errors propagate to Live Sync", async () => {
  const empty=new Response(null,{status:200});
  const c=new AbortController();
  assert.equal(await readBoundedManifestBody(empty,c),null);
  assert.equal(c.signal.aborted,true);

  const cause=new DOMException("aborted","AbortError");
  const stream=new ReadableStream({pull(){throw cause;}},{highWaterMark:0});
  await assert.rejects(readBoundedManifestBody(new Response(stream),new AbortController()),/aborted/);
});
