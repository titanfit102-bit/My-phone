// Live Sync is a READ-ONLY browser poller model. It cannot inspect private CI
// without an authenticated backend, and it never claims a GitHub build succeeded.
export const SYNC_POLL_MS = 15000;
export const FALLBACK_REFRESH_MS = 60000;
export const FETCH_TIMEOUT_MS = 8000;
export const MAX_MANIFEST_BYTES = 16384;

/**
 * Read only a bounded number of UTF-8 BYTES from an untrusted deployment manifest.
 * Return null when the body is too large or cannot be streamed safely.
 * Network/abort/decode errors propagate to the existing unreachable fallback.
 * Streaming still receives one browser-provided chunk at a time; it cannot limit
 * that individual chunk allocation, but never buffers an unbounded whole body.
 */
export async function readBoundedManifestText(response, maxBytes = MAX_MANIFEST_BYTES) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1)
    throw new RangeError("Invalid manifest byte limit.");
  const header = response.headers?.get?.("content-length");
  if (header !== null && header !== undefined && /^\d+$/.test(header.trim()) &&
      BigInt(header.trim()) > BigInt(maxBytes)) return null;
  if (!response.body || typeof response.body.getReader !== "function") return null;
  const reader = response.body.getReader();
  const parts = [];
  let used = 0;
  let complete = false;
  try {
    while (true) {
      const {value, done} = await reader.read();
      if (done) {complete = true; break;}
      if (!(value instanceof Uint8Array)) throw new TypeError("Non-byte manifest stream.");
      if (value.byteLength > maxBytes - used) return null;
      used += value.byteLength;
      parts.push(value);
    }
    const all = new Uint8Array(used);
    let offset = 0;
    for (const part of parts) {all.set(part, offset); offset += part.byteLength;}
    return new TextDecoder("utf-8", {fatal:true}).decode(all);
  } finally {
    if (!complete) {
      try {await reader.cancel();} catch { /* signal abort may already cancel */ }
    }
    reader.releaseLock();
  }
}

export function manifestUrl(deployedAppUrl) {
  const base = new URL(deployedAppUrl);
  if (base.protocol !== "https:" || base.username || base.password)
    throw new Error("Deployment must use an HTTPS URL without credentials.");
  const endpoint = new URL("/build-info.json", base);
  endpoint.searchParams.set("myphone_check", String(Date.now()));
  return endpoint.href;
}

export function parseManifest(payload) {
  if (!payload || Array.isArray(payload) || typeof payload !== "object") return null;
  if (typeof payload.revision !== "string" ||
      !/^[A-Za-z0-9._-]{1,128}$/.test(payload.revision)) return null;
  const builtAt = typeof payload.builtAt === "string" &&
    Number.isFinite(Date.parse(payload.builtAt)) ? payload.builtAt : null;
  // A revision is the authoritative identifier. builtAt is supporting metadata.
  return {
    revision: payload.revision,
    builtAt,
    fingerprint: payload.revision + "|" + (builtAt || "")
  };
}

export function initialSyncState() {
  return {
    phase: "checking",
    strategy: "unknown",
    revision: null,
    fingerprint: null,
    // observed publication vs the version last explicitly applied to the iframe
    displayedFingerprint: null,
    displayedRevision: null,
    pendingFingerprint: null,
    pendingRevision: null,
    builtAt: null,
    checkedAt: null,
    changedAt: null,
    failures: 0
  };
}

/** Pure transition: no network, no timers, no browser globals. */
export function transitionSync(prev, outcome, checkedAt, {frozen = false} = {}) {
  const state = {...prev, checkedAt};
  if (outcome?.kind === "published" && outcome.manifest) {
    const manifest = outcome.manifest;
    const isNew = !!prev.fingerprint && prev.fingerprint !== manifest.fingerprint;
    // First observation anchors the already-mounted iframe without reloading it.
    // "Displayed" is an observer-side reference, NOT a guarantee of pinned bytes:
    // the embedded application can navigate or refresh on its own.
    const displayed = prev.displayedFingerprint || manifest.fingerprint;
    state.displayedFingerprint = displayed;
    state.displayedRevision = prev.displayedRevision || manifest.revision;
    state.phase = "published";
    state.strategy = "manifest";
    state.revision = manifest.revision;
    state.fingerprint = manifest.fingerprint;
    state.builtAt = manifest.builtAt;
    state.changedAt = isNew ? checkedAt : prev.changedAt;
    state.failures = 0;

    if (manifest.fingerprint === displayed) {
      // A deployment rollback may match the visible reference again.
      state.pendingFingerprint = null;
      state.pendingRevision = null;
      return {state, reload: false};
    }
    if (frozen) {
      state.pendingFingerprint = manifest.fingerprint;
      state.pendingRevision = manifest.revision;
      return {state, reload: false};
    }
    state.displayedFingerprint = manifest.fingerprint;
    state.displayedRevision = manifest.revision;
    state.pendingFingerprint = null;
    state.pendingRevision = null;
    return {state, reload: true};
  }
  if (outcome?.kind === "restricted") {
    state.phase = "restricted";
    state.strategy = "unknown";
    state.failures += 1;
    return {state, reload: false};
  }
  if (outcome?.kind === "unsupported" || outcome?.kind === "unreachable") {
    state.phase = outcome.kind;
    state.strategy = "fallback";
    state.failures += outcome.kind === "unreachable" ? 1 : 0;
    return {state, reload: false};
  }
  // Unexpected results must never imply that a new build is ready.
  state.phase = "unreachable";
  state.strategy = "fallback";
  state.failures += 1;
  return {state, reload: false};
}

// Manual acceptance updates the observer reference exactly once. Calling it
// repeatedly without a pending release never triggers another automatic reload.
export function applyPendingSync(prev) {
  if (!prev.pendingFingerprint) return {state: prev, reload: false};
  return {
    state: {
      ...prev,
      displayedFingerprint: prev.pendingFingerprint,
      displayedRevision: prev.pendingRevision,
      pendingFingerprint: null,
      pendingRevision: null
    },
    reload: true
  };
}

export function summarizeSync(state) {
  switch (state.phase) {
    case "published":
      return {title: "Publikimi u verifikua", detail: "Versioni vjen nga build-info.json i aplikacionit.", ok:true};
    case "unsupported":
      return {title: "Version i paverifikueshëm", detail: "Ky aplikacion nuk publikon build-info.json. Rifreskim rezervë.", ok:false};
    case "unreachable":
      return {title: "Kontroll i kufizuar", detail: "Rrjeti, CORS ose serveri bllokoi metadata-t. Rifreskim rezervë.", ok:false};
    case "restricted":
      return {title: "Kërkohet autorizim", detail: "Metadata-t janë të mbrojtura. Nuk kemi akses te statusi.", ok:false};
    case "paused":
      return {title: "Sinkronizimi i ndalur", detail: "Kontrolli automatik është çaktivizuar.", ok:false};
    default:
      return {title: "Po kontrollojmë publikimin", detail: "Nuk kemi ende metadata të konfirmuara.", ok:false};
  }
}
