import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
import {execFileSync} from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFile(resolve(root, path), "utf8");

test("extension UI references existing elements and ships no remote scripts", async () => {
  const html = await read("extension/sidepanel.html");
  const js = await read("extension/sidepanel.js");
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
  const accessed = [...js.matchAll(/element\("([^"]+)"\)/g)].map((match) => match[1]);
  for (const id of accessed) assert.ok(ids.has(id), "Missing element: " + id);
  assert.match(html, /src="sidepanel\.js"/);
  assert.doesNotMatch(html, /<script[^>]+https?:\/\//i);
  assert.doesNotMatch(js, /\.innerHTML\s*=/);
  for (const file of ["extension/sidepanel.js", "extension/project-model.js"]) {
    execFileSync(process.execPath, ["--check", resolve(root, file)]);
  }
});
test("project picker, editor, preview and manual tab fallback are included", async () => {
  const html = await read("extension/sidepanel.html");
  for (const id of ["projectSelect", "projectForm", "githubUrl", "previewUrl",
    "previewFrame", "grantPermission", "reloadButton", "openTab", "deleteProject"]) {
    assert.ok(html.includes('id="' + id + '"'), "UI missing: " + id);
  }
});
