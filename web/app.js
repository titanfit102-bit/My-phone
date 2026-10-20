"use strict";
const topbar = document.getElementById("topbar");
const profileButton = document.getElementById("profileButton");
const homeScreen = document.getElementById("homeScreen");
const profileScreen = document.getElementById("profileScreen");
const toast = document.getElementById("toast");
let toastTimeout;

function showView(name) {
  const isProfile = name === "profile";
  homeScreen.hidden = isProfile;
  profileScreen.hidden = !isProfile;
  document.querySelectorAll("[data-view]").forEach((button) => {
    const active = button.dataset.view === name;
    button.classList.toggle("nav-active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
}
function notify(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("visible"), 2700);
}
function applyDemoState(value) {
  if (!value || typeof value !== "object") return;
  const position = value.profilePosition === "right" ? "right" : "left";
  topbar.dataset.profilePosition = position;
  document.getElementById("positionLabel").textContent = position === "right" ? "Djathtas" : "Majtas";
  if (typeof value.appName === "string" && value.appName.length > 0 && value.appName.length < 40)
    document.getElementById("appName").textContent = value.appName;
  if (typeof value.accentColor === "string" && /^#[0-9a-fA-F]{6}$/.test(value.accentColor))
    document.documentElement.style.setProperty("--accent", value.accentColor);
}
async function initializeDemo() {
  try {
    const response = await fetch("./demo-state.json", {cache: "no-store"});
    if (!response.ok) throw new Error("Config not available");
    applyDemoState(await response.json());
  } catch {
    notify("U përdor konfigurimi fillestar i demos.");
  }
}
profileButton.addEventListener("click", () => showView("profile"));
document.getElementById("backButton").addEventListener("click", () => showView("home"));
document.getElementById("tryButton").addEventListener("click", () => notify("Demo funksionon. Pozicioni ndryshohet nga ChatGPT përmes GitHub."));
document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => showView(button.dataset.view)));
initializeDemo();
