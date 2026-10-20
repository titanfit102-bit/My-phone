import test from "node:test";
import assert from "node:assert/strict";
import {readFile, access} from "node:fs/promises";
import {execFileSync} from "node:child_process";
import {resolve} from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFile(resolve(root, path), "utf8");

test("config has a supported profile position and valid color", async () => {
  const cfg = JSON.parse(await read("web/demo-state.json"));
  assert.ok(["left", "right"].includes(cfg.profilePosition));
  assert.match(cfg.accentColor, /^#[0-9a-fA-F]{6}$/);
});
test("Chrome extension exposes a side panel without persistent broad host access", async () => {
  const manifest = JSON.parse(await read("extension/manifest.json"));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.side_panel.default_path, "sidepanel.html");
  assert.ok(manifest.optional_host_permissions.includes("https://*/*"));
  assert.ok(!manifest.permissions.includes("<all_urls>"));
});
test("browser scripts are syntactically valid", async () => {
  for (const file of ["web/app.js", "extension/background.js", "extension/sidepanel.js"]) {
    execFileSync(process.execPath, ["--check", resolve(root, file)]);
  }
});
test("standalone build emits files and build metadata", async () => {
  execFileSync(process.execPath, [resolve(root, "scripts/build.mjs")]);
  for (const file of ["dist/index.html", "dist/styles.css", "dist/app.js", "dist/demo-state.json"]) {
    await access(resolve(root, file));
  }
  const info = JSON.parse(await read("dist/build-info.json"));
  assert.equal(typeof info.revision, "string");
  assert.ok(info.revision.length > 0);
  assert.ok(Number.isFinite(Date.parse(info.builtAt)));
});
