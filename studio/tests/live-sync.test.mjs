import test from "node:test";
import assert from "node:assert/strict";
import {
  manifestUrl, parseManifest, transitionSync, initialSyncState, summarizeSync,
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
