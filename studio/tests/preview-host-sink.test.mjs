import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
import {runInNewContext} from "node:vm";
import ts from "typescript";
import {cleanAppetizeEmbed, cleanWebUrl} from "../src/project-model.js";

// Render the *actual* PreviewHost component with attacker-controlled props.
// The test-only JSX/React Native stubs return element descriptions; no browser,
// provider network request, production hook, or paid Appetize session is used.
const source = readFileSync(new URL("../src/PreviewHost.web.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  fileName: "PreviewHost.web.tsx",
  compilerOptions: {
    jsx: ts.JsxEmit.ReactJSX,
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
  reportDiagnostics: true,
});
assert.deepEqual(compiled.diagnostics ?? [], [], "PreviewHost must transpile without errors");

const element = (type, props, key) => ({type, props, key});
const permittedImports = Object.freeze({
  "react/jsx-runtime": {jsx: element, jsxs: element},
  "react": {},
  "react-native": {
    View: "View",
    Text: "Text",
    StyleSheet: {create: styles => styles},
  },
  "./project-model": {cleanAppetizeEmbed, cleanWebUrl},
});
const componentModule = {exports: {}};
runInNewContext(compiled.outputText, {
  module: componentModule,
  exports: componentModule.exports,
  require(specifier) {
    if (!Object.hasOwn(permittedImports, specifier)) {
      throw new Error("Unexpected component dependency: " + specifier);
    }
    return permittedImports[specifier];
  },
}, {timeout: 2000, filename: "PreviewHost.web.transpiled.cjs"});
const renderPreviewHost = componentModule.exports.default;
assert.equal(typeof renderPreviewHost, "function");

test("SEC-04 direct sink: canonical Appetize URL creates only expected provider iframe", () => {
  const rendered = renderPreviewHost({
    url: "https://appetize.io/embed/abc12345/",
    variant: "native",
    revision: 3,
    title: "Synthetic",
  });
  assert.equal(rendered.type, "iframe");
  assert.equal(rendered.props.src, "https://appetize.io/embed/abc12345");
  assert.equal(rendered.props.referrerPolicy, "no-referrer");
  assert.equal(rendered.props.sandbox, "allow-scripts allow-same-origin allow-forms allow-popups");
  assert.equal(rendered.props.title, "Synthetic · Android cloud");
});

const rejectedNativeURLs = [
  ["lookalike domain", "https://appetize.io.evil.example/embed/abc12345"],
  ["untrusted HTTP", "http://appetize.io/embed/abc12345"],
  ["credentials", "https://user:password@appetize.io/embed/abc12345"],
  ["secret-bearing query", "https://appetize.io/embed/abc12345?token=private"],
  ["fragment", "https://appetize.io/embed/abc12345#private"],
  ["wrong path", "https://appetize.io/other/abc12345"],
  ["script URL", "javascript:alert(1)"],
];

for (const [description, url] of rejectedNativeURLs) {
  test("SEC-04 direct sink rejects " + description + " without reflecting the URL", () => {
    // Bypasses project form, registry load, and all existing upstream validation.
    const rendered = renderPreviewHost({url, variant: "native", revision: 0, title: "Synthetic"});
    assert.equal(rendered.type, "View");
    assert.notEqual(rendered.type, "iframe");
    assert.equal(rendered.props.children.type, "Text");
    assert.match(rendered.props.children.props.children, /Appetize/);
    assert.equal(JSON.stringify(rendered).includes(url), false, "No secret-bearing URL in error UI");
  });
}

test("SEC-04 external Web preview still uses opaque sandbox on the same real component", () => {
  const rendered = renderPreviewHost({
    url: "https://example.test/app",
    variant: "web",
    revision: 2,
    title: "Synthetic",
  });
  assert.equal(rendered.type, "iframe");
  assert.equal(rendered.props.src, "https://example.test/app");
  assert.equal(rendered.props.sandbox, "allow-scripts allow-forms");
  assert.equal(rendered.props.referrerPolicy, "no-referrer");
});

test("SEC-04 direct native sink fails closed if a future caller bypasses TypeScript at runtime", () => {
  const rendered = renderPreviewHost({
    url: {href: "https://appetize.io/embed/abc12345"},
    variant: "native",
    revision: 4,
    title: "Synthetic",
  });
  assert.equal(rendered.type, "View");
  assert.equal(rendered.props.children.type, "Text");
  assert.equal(rendered.props.children.props.children, "Lidhja Appetize nuk është e vlefshme.");
});

test("SEC-04 direct Web sink preserves a validated deployed HTTPS preview URL", () => {
  const url = "https://preview.example.test/app?tab=home&myphone_refresh=12";
  const rendered = renderPreviewHost({url, variant: "web", revision: 12, title: "Synthetic"});
  assert.equal(rendered.type, "iframe");
  assert.equal(rendered.props.src, url);
  assert.equal(rendered.props.sandbox, "allow-scripts allow-forms");
  assert.equal(rendered.props.referrerPolicy, "no-referrer");
});

const rejectedWebURLs = [
  ["HTTP", "http://preview.example.test/app"],
  ["script scheme", "javascript:alert(1)"],
  ["data scheme", "data:text/html,<script>alert(1)</script>"],
  ["protocol relative", "//preview.example.test/app"],
  ["embedded credentials", "https://user:secret@preview.example.test/app"],
  ["secret fragment", "https://preview.example.test/app#secret"],
  ["nonstandard port", "https://preview.example.test:8443/app"],
  ["non-string object", {href: "https://preview.example.test/app"}],
];
for (const [description, url] of rejectedWebURLs) {
  test("SEC-04 direct Web sink denies " + description + " without an iframe", () => {
    // Bypasses normal saved-project validation to test the actual privileged sink.
    const rendered = renderPreviewHost({url, variant: "web", revision: 0, title: "Synthetic"});
    assert.equal(rendered.type, "View");
    assert.equal(rendered.props.children.type, "Text");
    assert.equal(rendered.props.children.props.children, "Lidhja Web nuk është e vlefshme.");
    assert.equal(JSON.stringify(rendered).includes("preview.example.test"), false);
    assert.equal(JSON.stringify(rendered).includes("secret"), false);
  });
}
test("SEC-04 unknown preview mode is rejected instead of inheriting native iframe privileges", () => {
  // A future JavaScript caller can bypass the compile-time 'web' | 'native' union.
  const rendered = renderPreviewHost({
    url: "https://preview.example.test/app",
    variant: "external-native-bypass",
    revision: 1,
    title: "Synthetic",
  });
  assert.equal(rendered.type, "View");
  assert.equal(rendered.props.children.type, "Text");
  assert.equal(rendered.props.children.props.children, "Modaliteti i preview nuk është i vlefshëm.");
});
