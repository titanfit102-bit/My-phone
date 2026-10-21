# Advanced ZIP Engine — Local CSS Assets (Phase 2, controlled slice)

**Status:** implementation under review in a stacked Draft PR, not Production.

## Objective

Extend temporary, offline Quick Preview for **prebuilt single-JS Vite-style Web artifacts** to accept multiple local stylesheets and image/font references from those stylesheets. This is incremental compatibility, not universal ZIP/source execution.

## Capabilities

- Exactly **one external JS bundle** referenced by the build's `index.html`, as before.
- Up to **four CSS files** linked by `index.html`, with a combined uncompressed CSS limit of **2 MiB**.
- Within CSS `url(...)`, resolve local files relative to the referencing CSS file (including safe `./` and `../` that remain inside the selected build root), or absolute paths relative to the build root.
- Support **raster images** `png`, `jpg`, `jpeg`, `gif`, `webp`, `avif`, and **fonts** `woff`, `woff2`, `ttf`, `otf`. Inline them as `data:` URLs within CSS inside the existing `srcDoc` payload.
- Identical local references are cached within the session; no upload or persistent storage.
- Existing `connect-src 'none'`, opaque-origin `sandbox="allow-scripts"` **without** `allow-same-origin`, `form-action 'none'`, same-origin separation and session-only close/reload behavior remain unchanged.

## Resource budgets

The existing ZIP structural checks apply first: ≤32 MiB ZIP, ≤5,000 central-directory entries, ≤512 MiB declared uncompressed total, unsafe paths/symlinks/encrypted entries rejected. Additional **extracted/embedded** caps:

| Resource | Limit |
|---|---|
| `index.html` | 256 KiB |
| Single JS bundle | 8 MiB |
| Total CSS across up to 4 stylesheets | 2 MiB |
| One local raster/font CSS asset | 512 KiB |
| Unique referenced assets | 24 |
| Sum of extracted referenced assets | 3 MiB |

Build and archive validation cannot attest that original JavaScript is harmless; the iframe remains a restricted best-effort preview for trusted user-owned builds.

## Deliberate limits

- **No** arbitrary multi-chunk ES module graph, `import()` loading, runtime `fetch()`, backend APIs, environment variables, authentication service, server-side routing, service worker, or Android execution.
- **No** SVG asset inlining or remote SVG/CDN resources. Non-whitelisted `data:` URLs and URL schemes are rejected.
- **No** `@import` inside CSS, even for local stylesheets. Publish CSS already bundled into linked files.
- CSS references using query strings, URL fragments (except local CSS `url(#id)` fragments) or percent-encoded file paths are intentionally restricted. Any unresolved local resource fails the preparation rather than falsely reporting `READY`.
- Existing HTML body is not cloned: the existing renderer creates its controlled `#root` and executes its single prebuilt JS entrypoint. Static `<img>` markup in original HTML and assets referenced dynamically from JavaScript are not rewritten.
- Prepared iframe HTML **does not mean** the entire app works; test actual screen interactions. Existing session-only storage shim remains best-effort.
- No ZIP data stored in My Projects. No tokens, new npm packages, backend, cloud runner or paid service.

## Verification

- Unit: multiple CSS, duplicate local references, binary raster/font inlining, path boundaries, missing files, remote URLs, SVG refusal, CSS imports, per-asset and aggregate/count limits, legacy single-CSS behavior.
- Browser desktop/mobile: uploaded fixture produces real CSS computed styles and a local raster `data:` URI in the sandbox iframe; close removes iframe, existing project features must not regress.
- CI: Node unit, TypeScript, Expo Web export, repo-isolation and Playwright all pass on exact HEAD.
- Test with user-owned real ZIP for acceptance, and verify the actual Preview SHA.
- Security advisory review remains necessary before any Production release. Parent PR #12, #13, #14 must be merged in order only with an explicit production release decision.

## Release and reversibility

The feature branch targets PR #14, preserving all previous isolation boundaries. If the extended renderer introduces regressions, reverting the renderer change returns to the previous single-CSS behavior. Never alter another application repository or bypass Vercel deployment authentication.
