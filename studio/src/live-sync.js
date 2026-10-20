// Live Sync is a READ-ONLY browser poller model. It cannot inspect private CI
// without an authenticated backend, and it never claims a GitHub build succeeded.
export const SYNC_POLL_MS = 15000;
export const FALLBACK_REFRESH_MS = 60000;
export const FETCH_TIMEOUT_MS = 8000;
export const MAX_MANIFEST_BYTES = 16384;

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
    builtAt: null,
    checkedAt: null,
    changedAt: null,
    failures: 0
  };
}

/** Pure transition: no network, no timers, no browser globals. */
export function transitionSync(prev, outcome, checkedAt) {
  const state = {...prev, checkedAt};
  if (outcome?.kind === "published" && outcome.manifest) {
    const manifest = outcome.manifest;
    const isNew = !!prev.fingerprint && prev.fingerprint !== manifest.fingerprint;
    state.phase = "published";
    state.strategy = "manifest";
    state.revision = manifest.revision;
    state.fingerprint = manifest.fingerprint;
    state.builtAt = manifest.builtAt;
    state.changedAt = isNew ? checkedAt : prev.changedAt;
    state.failures = 0;
    return {state, reload: isNew};
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
