// Pure data rules shared by the Chrome panel and Node tests.
// Never store API tokens, passwords or unrestricted user-supplied HTML.
export const STORAGE_KEY = "myPhoneProjectsV2";
export const POLL_INTERVAL_MS = 15000;
export const FALLBACK_RELOAD_MS = 60000;

export function normalizeGithubUrl(value) {
  if (typeof value !== "string") throw new Error("Vendos URL e repository-t në GitHub.");
  let url;
  try { url = new URL(value.trim()); } catch { throw new Error("URL e GitHub nuk është e vlefshme."); }
  const segments = url.pathname.replace(/\/$/, "").split("/").filter(Boolean);
  if (url.protocol !== "https:" || url.hostname !== "github.com" || url.port ||
      url.username || url.password || url.search || url.hash || segments.length !== 2 ||
      !/^[a-zA-Z0-9-]{1,39}$/.test(segments[0]) ||
      !/^[a-zA-Z0-9._-]{1,100}$/.test(segments[1]))
    throw new Error("Përdor formatin https://github.com/pronari/repository.");
  const repoName = segments[1].replace(/\.git$/, "");
  if (!repoName || repoName === "." || repoName === "..")
    throw new Error("Emër repository i pavlefshëm.");
  return "https://github.com/" + segments[0] + "/" + repoName;
}

export function normalizePreviewUrl(value) {
  if (typeof value !== "string") throw new Error("Vendos URL e demos së publikuar.");
  let url;
  try { url = new URL(value.trim()); } catch { throw new Error("URL e demos nuk është e vlefshme."); }
  const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if ((url.protocol !== "https:" && !(isLocal && url.protocol === "http:")) ||
      url.username || url.password || url.search || url.hash)
    throw new Error("Përdor HTTPS (ose localhost) pa parametra apo kredenciale.");
  const path = url.pathname.endsWith("/") ? url.pathname : url.pathname + "/";
  return url.origin + path;
}

export function hostPattern(previewUrl) {
  const url = new URL(previewUrl);
  return url.origin + "/*";
}

export function makeProject(fields, id) {
  const name = String(fields.name || "").trim();
  if (!name || name.length > 64) throw new Error("Emri duhet të jetë 1–64 karaktere.");
  if (typeof id !== "string" || !/^[a-zA-Z0-9-]{6,64}$/.test(id))
    throw new Error("ID e projektit nuk është e vlefshme.");
  return {
    id,
    name,
    githubUrl: normalizeGithubUrl(fields.githubUrl),
    previewUrl: normalizePreviewUrl(fields.previewUrl)
  };
}

export function parseBuildInfo(value) {
  if (!value || typeof value !== "object" ||
      typeof value.revision !== "string" || !/^[a-zA-Z0-9._-]{1,128}$/.test(value.revision))
    return null;
  const builtAt = typeof value.builtAt === "string" && Number.isFinite(Date.parse(value.builtAt))
    ? value.builtAt : null;
  return {revision: value.revision, builtAt, fingerprint: value.revision + "|" + (builtAt || "")};
}

export function restoreState(saved) {
  const source = saved && typeof saved === "object" ? saved : {};
  const state = source[STORAGE_KEY];
  const projects = [];
  const ids = new Set();
  if (state && Array.isArray(state.projects)) {
    for (const candidate of state.projects.slice(0, 100)) {
      try {
        const project = makeProject(candidate, candidate.id);
        if (!ids.has(project.id)) { projects.push(project); ids.add(project.id); }
      } catch { /* Ignore invalid local-storage entries. */ }
    }
  }
  // Upgrade the original one-URL implementation without erasing the old value.
  if (!projects.length && typeof source.previewOrigin === "string") {
    try {
      projects.push(makeProject({
        name: "My Phone · Demo",
        githubUrl: "https://github.com/titanfit102-bit/My-phone",
        previewUrl: source.previewOrigin
      }, "legacy-my-phone"));
    } catch { /* A previous malformed URL must not break the panel. */ }
  }
  const candidateId = state && typeof state.activeId === "string" ? state.activeId : "";
  return {
    projects,
    activeId: projects.some((project) => project.id === candidateId)
      ? candidateId : (projects[0]?.id || null)
  };
}

export function saveableState(projects, activeId) {
  return {projects, activeId: projects.some((p) => p.id === activeId) ? activeId : (projects[0]?.id || null)};
}
