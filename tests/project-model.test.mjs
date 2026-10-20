import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeGithubUrl, normalizePreviewUrl, hostPattern, makeProject,
  parseBuildInfo, restoreState, saveableState, STORAGE_KEY
} from "../extension/project-model.js";

test("GitHub repository URLs are normalized and restricted to exact GitHub host", () => {
  assert.equal(normalizeGithubUrl(" https://github.com/example/real-repo.git "), "https://github.com/example/real-repo");
  for (const invalid of ["http://github.com/example/repo", "https://github.com.evil.test/a/b",
    "https://github.com/a/b/tree/main", "https://github.com/a", "https://github.com/a/b?token=abc",
    "javascript:alert(1)", "https://person:pw@github.com/a/b"]) {
    assert.throws(() => normalizeGithubUrl(invalid), invalid);
  }
});
test("Preview URL security allows HTTPS or loopback HTTP only", () => {
  assert.equal(normalizePreviewUrl("https://demo.vercel.app"), "https://demo.vercel.app/");
  assert.equal(normalizePreviewUrl("https://example.com/apps/demo/"), "https://example.com/apps/demo/");
  assert.equal(normalizePreviewUrl("http://127.0.0.1:4173"), "http://127.0.0.1:4173/");
  assert.equal(hostPattern("https://demo.vercel.app/apps/"), "https://demo.vercel.app/*");
  for (const invalid of ["http://demo.vercel.app", "javascript:alert(1)",
    "https://demo.vercel.app/?token=secret", "https://user:pass@example.com",
    "file:///etc/passwd"]) assert.throws(() => normalizePreviewUrl(invalid), invalid);
});
test("project validation and parsing publication metadata", () => {
  const p = makeProject({name: "  Social App  ", githubUrl: "https://github.com/owner/social", previewUrl: "https://demo.example.com"}, "project-id-123");
  assert.equal(p.name, "Social App");
  assert.equal(p.previewUrl, "https://demo.example.com/");
  assert.equal(parseBuildInfo({revision: "abc123", builtAt: "2026-10-20T10:00:00Z"}).revision, "abc123");
  assert.equal(parseBuildInfo({revision: "<script>"}), null);
  assert.equal(parseBuildInfo({revision: 13}), null);
  assert.equal(parseBuildInfo(null), null);
});
test("storage can recover valid projects and the selected active project", () => {
  const project = makeProject({name: "Test", githubUrl: "https://github.com/o/r", previewUrl: "https://demo.example.com"}, "project-id-123");
  const stored = {[STORAGE_KEY]: {projects: [project, {...project}, {broken:true}], activeId: "project-id-123"}};
  const restored = restoreState(stored);
  assert.equal(restored.projects.length, 1);
  assert.equal(restored.activeId, project.id);
  assert.equal(saveableState([], project.id).activeId, null);
  assert.equal(restoreState({previewOrigin: "https://old.example.com"}).projects[0].id, "legacy-my-phone");
});
