import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
import {runInNewContext} from "node:vm";
import ts from "typescript";
import {cleanAppetizeEmbed} from "../src/project-model.js";

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
  "./project-model": {cleanAppetizeEmbed},
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
