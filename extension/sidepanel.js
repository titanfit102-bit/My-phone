import {
  STORAGE_KEY, POLL_INTERVAL_MS, FALLBACK_RELOAD_MS, makeProject,
  parseBuildInfo, restoreState, saveableState, hostPattern
} from "./project-model.js";

const element = (id) => document.getElementById(id);
const select = element("projectSelect");
const editor = element("editor");
const emptyState = element("emptyState");
const workspace = element("workspace");
const form = element("projectForm");
const frame = element("previewFrame");
const placeholder = element("previewPlaceholder");
const indicator = element("indicator");

let store = {projects: [], activeId: null};
let editingId = null;
let generation = 0;
let timer = null;
let controller = null;
let busy = false;
let fingerprint = "";
let mode = "unknown";
let lastReloadAt = 0;

const active = () => store.projects.find((project) => project.id === store.activeId) || null;
const setText = (id, value) => { element(id).textContent = value; };
const setStatus = (text, state = "pending") => {
  setText("syncStatus", text);
  indicator.classList.toggle("online", state === "online");
  indicator.classList.toggle("error", state === "error");
};
function stopSync() {
  generation += 1;
  if (timer) clearInterval(timer);
  timer = null;
  if (controller) controller.abort();
  controller = null;
  busy = false;
}
function renderPicker() {
  const selected = store.activeId;
  select.replaceChildren();
  const placeholderOption = document.createElement("option");
  placeholderOption.value = "";
  placeholderOption.textContent = store.projects.length ? "Zgjidh projektin" : "Nuk ka projekte";
  select.append(placeholderOption);
  for (const project of store.projects) {
    const option = document.createElement("option");
    option.value = project.id;
    option.textContent = project.name;
    select.append(option);
  }
  select.value = selected || "";
  setText("projectCount", store.projects.length + (store.projects.length === 1 ? " projekt" : " projekte"));
}
async function persist() {
  store = saveableState(store.projects, store.activeId);
  await chrome.storage.local.set({[STORAGE_KEY]: store});
}
function openEditor(project = null) {
  stopSync();
  editingId = project ? project.id : null;
  setText("editorTitle", project ? "Ndrysho lidhjen" : "Shto aplikacion");
  setText("saveProject", project ? "Ruaj ndryshimet ↗" : "Ruaj dhe lidhe projektin ↗");
  element("projectName").value = project?.name || "";
  element("githubUrl").value = project?.githubUrl || "";
  element("previewUrl").value = project?.previewUrl || "";
  element("formError").hidden = true;
  editor.hidden = false;
  workspace.hidden = true;
  emptyState.hidden = true;
  element("projectName").focus();
}
async function closeEditor() {
  editor.hidden = true;
  editingId = null;
  await activate(store.activeId, false);
}
function previewUrlWithNonce(project) {
  const url = new URL(project.previewUrl);
  // Changing the query forces a fresh document request without modifying the app files.
  url.searchParams.set("myphone_preview", String(Date.now()));
  return url.href;
}
function loadFrame(project) {
  lastReloadAt = Date.now();
  frame.hidden = false;
  placeholder.hidden = true;
  frame.src = previewUrlWithNonce(project);
}
function displayProject(project) {
  editor.hidden = true;
  emptyState.hidden = true;
  workspace.hidden = false;
  setText("activeName", project.name);
  element("githubLink").href = project.githubUrl;
  element("historyLink").href = project.githubUrl + "/commits";
  setText("revision", "—");
  setText("lastChecked", "Kontroll automatik çdo 15 sekonda");
  setStatus("Po kontrolloj publikimin...");
  loadFrame(project);
}
async function activate(id, save = true) {
  stopSync();
  store.activeId = store.projects.some((project) => project.id === id) ? id : (store.projects[0]?.id || null);
  if (save) await persist();
  renderPicker();
  const project = active();
  if (!project) {
    editor.hidden = true;
    workspace.hidden = true;
    emptyState.hidden = false;
    setText("footerStatus", "Projektet ruhen lokalisht");
    return;
  }
  displayProject(project);
  fingerprint = "";
  mode = "unknown";
  const token = generation;
  const permitted = await chrome.permissions.contains({origins: [hostPattern(project.previewUrl)]});
  if (token !== generation) return;
  element("grantPermission").hidden = permitted;
  if (!permitted) {
    setStatus("Pamja hapet; sinkronizimi kërkon leje.", "pending");
    setText("lastChecked", "Kliko “Lejo sinkronizimin” për këtë adresë");
    return;
  }
  setText("footerStatus", "Sinkronizimi aktiv");
  await poll(token);
  if (token === generation) timer = setInterval(() => void poll(token), POLL_INTERVAL_MS);
}
function fallbackReload(project) {
  mode = "fallback";
  if (Date.now() - lastReloadAt >= FALLBACK_RELOAD_MS) loadFrame(project);
  setText("revision", "AUTO");
  setStatus("Rifreskim automatik çdo 60 sek.", "online");
  setText("lastChecked", "Pa build-info.json · Për kontroll të saktë shto metadata në aplikacion");
}
async function poll(token) {
  if (token !== generation || busy) return;
  const project = active();
  if (!project || editor.hidden === false) return;
  busy = true;
  const abort = new AbortController();
  controller = abort;
  try {
    const url = new URL("/build-info.json", project.previewUrl);
    url.searchParams.set("t", String(Date.now()));
    const response = await fetch(url.href, {cache: "no-store", credentials: "omit", signal: abort.signal});
    if (token !== generation) return;
    if (response.status === 404 || response.status === 405) {
      fallbackReload(project);
      return;
    }
    if (response.status === 401 || response.status === 403) {
      setStatus("Publikimi kërkon hyrje ose leje.", "error");
      setText("lastChecked", "Hap në tab për të kontrolluar aksesin");
      return;
    }
    if (!response.ok) throw new Error("HTTP " + response.status);
    const payload = await response.json().catch(() => null);
    if (token !== generation) return;
    const info = parseBuildInfo(payload);
    if (!info) {
      fallbackReload(project);
      return;
    }
    mode = "manifest";
    const previous = fingerprint;
    fingerprint = info.fingerprint;
    if (previous && previous !== fingerprint) loadFrame(project);
    setStatus(previous && previous !== fingerprint ? "U zbulua dhe u ngarkua version i ri." : "Demonstrimi është i lidhur.", "online");
    setText("revision", info.revision.slice(0, 9));
    setText("lastChecked", "Kontrolli: " + new Date().toLocaleTimeString("sq-AL") +
      (info.builtAt ? " · Publikuar: " + new Date(info.builtAt).toLocaleDateString("sq-AL") : ""));
  } catch (error) {
    if (token !== generation || abort.signal.aborted) return;
    // Network errors may be temporary during an in-progress deployment.
    setStatus("Nuk u kontrollua dot publikimi.", "error");
    setText("lastChecked", String(error?.message || "Rrjeti nuk përgjigjet").slice(0, 140));
    if (mode === "fallback") fallbackReload(project);
  } finally {
    if (token === generation) busy = false;
  }
}
async function requestAccess(project) {
  // This must be called directly by a user gesture (form submit / click).
  return chrome.permissions.request({origins: [hostPattern(project.previewUrl)]});
}
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const errorLabel = element("formError");
  errorLabel.hidden = true;
  try {
    const id = editingId || crypto.randomUUID();
    const project = makeProject({
      name: element("projectName").value,
      githubUrl: element("githubUrl").value,
      previewUrl: element("previewUrl").value
    }, id);
    const granted = await requestAccess(project);
    if (!granted) throw new Error("Chrome nuk dha lejen për të kontrolluar këtë faqe.");
    if (editingId) {
      store.projects = store.projects.map((old) => old.id === editingId ? project : old);
    } else {
      store.projects.push(project);
    }
    store.activeId = project.id;
    await persist();
    await activate(project.id, false);
  } catch (error) {
    errorLabel.textContent = String(error?.message || "Nuk mund të ruhet projekti.");
    errorLabel.hidden = false;
  }
});
select.addEventListener("change", () => void activate(select.value));
element("newProject").addEventListener("click", () => openEditor());
element("emptyAdd").addEventListener("click", () => openEditor());
element("cancelEditor").addEventListener("click", () => void closeEditor());
element("editProject").addEventListener("click", () => { const project = active(); if (project) openEditor(project); });
element("deleteProject").addEventListener("click", async () => {
  const project = active();
  if (!project || !confirm("Ta heqim “" + project.name + "” nga My Phone? Repository në GitHub nuk preket.")) return;
  stopSync();
  store.projects = store.projects.filter((item) => item.id !== project.id);
  store.activeId = store.projects[0]?.id || null;
  await persist();
  await activate(store.activeId, false);
});
element("grantPermission").addEventListener("click", async () => {
  const project = active();
  if (!project) return;
  try {
    if (await requestAccess(project)) await activate(project.id, false);
    else setStatus("Leja për sinkronizim nuk u miratua.", "error");
  } catch (error) { setStatus(String(error?.message || "Nuk u mor leja."), "error"); }
});
element("reloadButton").addEventListener("click", () => {
  const project = active();
  if (!project) return;
  loadFrame(project);
  setStatus("U kërkua rifreskimi manual.", "pending");
  void poll(generation);
});
element("openTab").addEventListener("click", () => {
  const project = active();
  if (project) void chrome.tabs.create({url: project.previewUrl});
});
async function boot() {
  try {
    const saved = await chrome.storage.local.get([STORAGE_KEY, "previewOrigin"]);
    store = restoreState(saved);
    renderPicker();
    await activate(store.activeId, true);
  } catch (error) {
    setText("projectCount", "Gabim");
    emptyState.hidden = false;
    setText("footerStatus", "Gabim gjatë hapjes së projekteve");
    console.error("My Phone failed to load", error);
  }
}
void boot();
