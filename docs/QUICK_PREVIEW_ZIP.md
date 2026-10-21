# Quick Preview ZIP — built Web artifact, not source compilation

Status: implementation PROPOSED on feature branch; requires passing CI and separate merge approval.

## Intent
For user-owned GitHub Download ZIPs containing a finished Vite React/Web bundle in `dist/`, render a **temporary** best-effort Web preview inside the My Phone Studio phone screen. Do not record the ZIP in `My Projects`; changing project, closing Quick Preview, or reloading the browser removes the in-memory iframe. No GitHub tokens, no PC setup, no cloud build costs.

The user-provided `12345678.zip` was inspected **read-only**: it contains `Pressa-Smart-main/dist/index.html`, one bundled JS (`dist/assets/index-CGWd5Iuu.js`) and one CSS (`dist/assets/index-Cmfy_3_c.css`). Its application bundle references `localStorage`, so the renderer attempts a memory-only replacement within the isolated frame. **The user archive is not copied into this repository, any CI artifact, or a cloud service.** Static compatibility inspection does not establish that every page, function or backend works.

## Flow
1. User selects local ZIP in the existing sidebar; 32 MiB ZIP cap and all original ZIP-structure validation still apply.
2. Detect exactly one `dist/index.html`, `build/index.html` or `out/index.html` in the archive.
3. Identify a single locally referenced JS bundle and zero or one CSS bundle. Extract only those assets in browser via native Deflate decompression or stored ZIP method, enforcing per-file decompression limits.
4. Create a fixed HTML document in RAM with inline CSS and bundled JS; block external network fetches via CSP; use an iframe `sandbox="allow-scripts"` **without** `allow-same-origin`. Code never executes in the Studio's origin.
5. Provide in-frame session-only storage semantics needed for many prototypes. Selecting another saved project or manually closing Quick Preview removes the preview. Never persist ZIP contents or the generated HTML.
6. Errors state precisely why an archive cannot be rendered.

## Trust and limitations
- No API/backend/database services are started; in particular, this is **not a live Pressa Smart production environment**.
- Rendering is best-effort for single-bundle builds. No support for chunked ESM, assets fetched at runtime, client-side absolute routes, service workers, authentication, external CDNs/fonts, or multi-file static websites that require hosting.
- A successful iframe load is **not proof** that all interactions work; real acceptance requires a manual test against the user-provided ZIP.
- The simple per-frame memory storage shim is not a full browser `Storage` implementation; applications may access unsupported APIs. No data survives reload.
- Sandbox stays opaque origin; adding `allow-same-origin` for a `srcDoc` frame would be an unacceptable isolation regression.
- Browser CSP blocks external fetches but cannot guarantee total absence of every side effect of arbitrary JS. Use only owned/trusted application builds.
- No dependency/npm packages added to the Studio. No new paid service, no source ZIP uploaded, no other repo changed.

## Acceptance
- Unit: decompress Deflate+stored ZIP; reject source-only/missing assets/unsafe paths/duplicate builds; verify generated CSP and inline code.
- Browser Chromium desktop/mobile: demonstrate visible HTML with interaction and temporary storage, close removes iframe, reload resets, source-only ZIP yields actionable message.
- Existing registry, Appetize, Live Sync, Session Freeze and remote Web Preview must continue to pass.
- User confirms merge separately. Production verification follows only if specifically approved.
