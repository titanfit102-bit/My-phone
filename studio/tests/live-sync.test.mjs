import test from "node:test";
import assert from "node:assert/strict";
import {
  manifestUrl, parseManifest, transitionSync, initialSyncState, applyPendingSync, summarizeSync,
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
