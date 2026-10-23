export const STORAGE_KEY = "my-phone-studio-projects-v1";
// Bound externally supplied preview URLs before they reach registry or backup.
export const MAX_WEB_URL_BYTES = 8192;

/** Portable UTF-8 byte count (including replacement bytes for lone surrogates). */
export function utf8ByteLength(value) {
  let bytes = 0;
  for (const symbol of value) {
    const cp = symbol.codePointAt(0);
    bytes += cp <= 0x7f ? 1 : cp <= 0x7ff ? 2 : cp <= 0xffff ? 3 : 4;
  }
  return bytes;
}

/** Store references to apps, NEVER binary APK files or credentials. */
export function cleanGithubUrl(input) {
  if (typeof input !== "string" || !input.trim()) throw Error("Vendos URL e GitHub.");
  let url;
  try { url = new URL(input.trim()); } catch { throw Error("URL e GitHub nuk është e vlefshme."); }
  const segments = url.pathname.replace(/\/$/, "").split("/").filter(Boolean);
  if (url.protocol !== "https:" || url.hostname !== "github.com" || url.port ||
      url.username || url.password || url.search || url.hash || segments.length !== 2 ||
      !/^[a-zA-Z0-9-]{1,39}$/.test(segments[0]) ||
      !/^[a-zA-Z0-9._-]{1,100}$/.test(segments[1]))
    throw Error("Përdor https://github.com/pronari/repository.");
  const repo = segments[1].replace(/\.git$/, "");
  if (!repo || repo === "." || repo === "..") throw Error("Repository i pavlefshëm.");
  return "https://github.com/" + segments[0] + "/" + repo;
}
export function cleanWebUrl(input) {
  if (!input) return "";
  if (typeof input !== "string") throw Error("URL Web nuk është e vlefshme.");
  let url;
  try { url = new URL(input.trim()); } catch { throw Error("URL Web nuk është e vlefshme."); }
  if (url.protocol !== "https:" || url.username || url.password || url.hash)
    throw Error("Përdor një adresë Web HTTPS pa kredenciale.");
  if (url.port && url.port !== "443") throw Error("Portet e personalizuara nuk lejohen në publikim.");
  if (utf8ByteLength(url.href) > MAX_WEB_URL_BYTES)
    throw Error("URL Web është tepër e gjatë (maksimumi 8192 byte).");
  return url.href;
}
export function cleanAppetizeEmbed(input) {
  if (!input) return "";
  if (typeof input !== "string") throw Error("URL e emulatorit nuk është e vlefshme.");
  let url;
  try { url = new URL(input.trim()); } catch { throw Error("URL e emulatorit nuk është e vlefshme."); }
  if (url.protocol !== "https:" || url.hostname !== "appetize.io" ||
      url.port || url.username || url.password || url.search || url.hash ||
      !/^\/embed\/[a-zA-Z0-9_-]{6,160}\/?$/.test(url.pathname))
    throw Error("Kopjo Share → Embed nga Appetize: https://appetize.io/embed/BUILD_ID.");
  return url.origin + url.pathname.replace(/\/$/, "");
}
export function newProject(fields, id) {
  const name = typeof fields.name === "string" ? fields.name.trim() : "";
  if (!name || name.length > 64) throw Error("Emri i projektit duhet të ketë 1–64 shkronja.");
  const github = cleanGithubUrl(fields.github);
  const web = cleanWebUrl(fields.web);
  const native = cleanAppetizeEmbed(fields.native);
  if (!web && !native) throw Error("Shto të paktën një lidhje Web ose APK cloud.");
  if (typeof id !== "string" || !/^[a-zA-Z0-9-]{6,70}$/.test(id)) throw Error("ID e pavlefshme.");
  return {id, name, github, web, native};
}
export function loadProjects(value) {
  try {
    const raw = typeof value === "string" ? JSON.parse(value) : value;
    if (!Array.isArray(raw)) return [];
    const ids = new Set();
    const result = [];
    for (const item of raw.slice(0, 100)) {
      try {
        const project = newProject(item, item.id);
        if (!ids.has(project.id)) {result.push(project); ids.add(project.id);}
      } catch { /* ignore invalid persisted records */ }
    }
    return result;
  } catch { return []; }
}
export function chooseMode(project, preferred) {
  if (preferred === "native" && project.native) return "native";
  if (preferred === "web" && project.web) return "web";
  return project.web ? "web" : "native";
}
export function freshWebUrl(value, revision) {
  const url = new URL(cleanWebUrl(value));
  url.searchParams.set("myphone_refresh", String(revision));
  return url.href;
}
