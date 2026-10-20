"use strict";
const input = document.getElementById("previewUrl");
const status = document.getElementById("status");
const frame = document.getElementById("previewFrame");
const placeholder = document.getElementById("placeholder");
const revisionLabel = document.getElementById("revision");
const reloadButton = document.getElementById("reloadButton");
let activeOrigin = "";
let currentRevision = "";
let inFlight = false;

function getPreviewOrigin(value) {
  const url = new URL(value.trim());
  const local = (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  if (url.protocol !== "https:" && !(local && url.protocol === "http:"))
    throw new Error("Përdor HTTPS ose localhost.");
  if (url.username || url.password) throw new Error("URL nuk duhet të ketë kredenciale.");
  if (url.pathname !== "/" || url.search || url.hash) throw new Error("Vendos URL-në bazë të aplikacionit, pa rrugë shtesë.");
  return url.origin;
}
function setStatus(message) {status.textContent = message;}
function showPreview(revision) {
  const destination = new URL("/", activeOrigin);
  destination.searchParams.set("bridge_rev", revision);
  frame.src = destination.href;
  frame.hidden = false;
  placeholder.hidden = true;
  reloadButton.disabled = false;
}
async function checkBuild(forceReload = false) {
  if (!activeOrigin || inFlight) return;
  inFlight = true;
  try {
    const endpoint = new URL("/build-info.json", activeOrigin);
    endpoint.searchParams.set("t", String(Date.now()));
    const response = await fetch(endpoint.href, {cache: "no-store", credentials: "omit"});
    if (!response.ok) throw new Error("build-info.json nuk u gjet (HTTP " + response.status + ")");
    const data = await response.json();
    if (typeof data.revision !== "string" || !data.revision) throw new Error("Version i pavlefshëm.");
    if (forceReload || currentRevision !== data.revision || frame.hidden) {
      currentRevision = data.revision;
      showPreview(data.revision);
      revisionLabel.textContent = "Versioni: " + data.revision.slice(0, 8);
      setStatus("Demo u përditësua me sukses.");
    } else {setStatus("E lidhur. Po kontrolloj për ndryshime.");}
  } catch (error) {
    setStatus("Nuk u verifikua versioni: " + error.message);
  } finally {inFlight = false;}
}
async function connect(value, requestAccess) {
  const origin = getPreviewOrigin(value);
  const pattern = origin + "/*";
  if (requestAccess) {
    const accepted = await chrome.permissions.request({origins: [pattern]});
    if (!accepted) throw new Error("Leja e Chrome për këtë faqe nuk u miratua.");
  } else {
    const granted = await chrome.permissions.contains({origins: [pattern]});
    if (!granted) {setStatus("Kliko Lidh demonstrimin për të dhënë lejen.");return;}
  }
  activeOrigin = origin;
  currentRevision = "";
  await chrome.storage.local.set({previewOrigin: origin});
  input.value = origin;
  await checkBuild(true);
}
document.getElementById("connectForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {await connect(input.value, true);}
  catch (error) {setStatus(error.message);}
});
reloadButton.addEventListener("click", () => checkBuild(true));
chrome.storage.local.get("previewOrigin").then((saved) => {
  if (saved.previewOrigin) {
    input.value = saved.previewOrigin;
    connect(saved.previewOrigin, false).catch((error) => setStatus(error.message));
  }
});
setInterval(() => checkBuild(), 15000);
