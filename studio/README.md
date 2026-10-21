# My Phone Developer Studio — Expo / React Native Web

A source-isolated, multi-project virtual device lab. **This is the STUDIO, not the source code of the apps it previews.**

## Features

- React Native UI driven by Expo, exportable as a website for Vercel.
- Add/select/edit/remove apps with their own GitHub repository, Web URL and optional Appetize Embed URL.
- Web mode: embed apps permitting cross-origin iframes; check /build-info.json every 15 seconds, reload on published changes, or preserve the iframe with opt-in Session Freeze. If metadata is unavailable, use 60-second fallback unless frozen.
- Native mode: show a REAL cloud Android device after you provide a valid Appetize build embed URL.
- Two distinct modes and explicit truth about what is and is not an APK test.
- The list is stored in this browser's localStorage, not synchronized across devices. Storage failures are visible and validated JSON export/import is available for manual backup/recovery.
- No API keys in the client; no paid cloud sessions start automatically.

## Quick Preview (built ZIP, session-only)

In Expo Web, **↑ Ngarko ZIP** can render a narrowly supported prebuilt Web `dist/index.html` bundle directly in the phone frame using an **opaque-origin iframe sandbox with scripts only**. CSS and JS are inflated in the browser from uploaded ZIP bytes; nothing is uploaded, persisted, installed or deployed. Any app data written to localStorage is intercepted by a small **ephemeral in-frame memory-only shim**, separate from Studio storage. Click **✕ Mbyll Quick Preview** to discard the view; reloading the Studio also clears it.

Limitations: one JS bundle, at most one CSS asset, no backend, network requests or external resources, no multiple JS chunks, no arbitrary source compilation, no Android APK. Some apps will be partially functional or incompatible; the feature is best-effort. The source ZIP inspector rejects invalid archives and per-asset decompression is additionally bounded. Do not set `allow-same-origin` on the ZIP iframe. Refer to [Quick Preview limits](../docs/QUICK_PREVIEW_ZIP.md).

## ZIP Import — first phase

The **↑ Ngarko ZIP** action in the Expo Web sidebar inspects a local GitHub Download ZIP file (32 MB cap) and reports indicative framework type and whether the archive contains source or a static build candidate. It reads only ZIP directory metadata and never decompresses, executes or uploads archive contents. **It does not yet build, deploy or display an app from the ZIP.** Deliberately treat all uploaded files as untrusted; do not bypass the parser to serve an HTML archive from the Studio origin. Native Expo interface reports that ZIP inspection is Web-only for this stage.

A future *separately authorized* build stage requires sandboxed remote execution, no user-app secrets in the browser, resource limits, safe artifact hosting and isolated origins. Real previews from raw GitHub source depend on this stage.

## Setup

Node.js 22.13+ recommended.

```bash
cd studio
npm ci
npm run check:config
npm run typecheck
npm run web
```

Build production Web export:

```bash
npm run export:web
```

Current Vercel project: **`my-phone-studio`**, with Studio source rooted at `studio/`; build command `npm run export:web`, output `dist`.

Production is already the **`my-phone-studio`** Vercel project (https://my-phone-studio.vercel.app), connected to this repository. Do not reconfigure the project, create another site, or merge without explicit approval. The old standalone preview website was retired.

## Link an external Expo app

Build that app in its own repository. Run `npx expo export --platform web` and deploy its output to Vercel in its own project. In this Studio add GitHub repository + stable deployment URL. Web preview shows the React Native Web version.

## Link a real Android APK

Build APK in the app's OWN repository using Expo EAS or other build service, then upload to Appetize with user-approved account. Copy its **Share > Embed** link and register it under Android Cloud APK. The cloud session will show the actual native build if Appetize credentials and permissions permit.

Appetize build IDs may be accessible by anyone who knows the link and may incur usage charges. Do not add restricted applications unless their sharing controls are configured appropriately. Updating app code in GitHub does NOT update an already-uploaded APK.

See [architecture](../docs/STUDIO_ARCHITECTURE.md) and [Appetize embedding](https://docs.appetize.io/platform/embedding-apps).

For backup/recovery, iframe-blocking CSP behavior and tests, see [hardening notes](../docs/IFRAME_STORAGE_HARDENING.md).
