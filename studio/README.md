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

Deploy to Vercel as **a separate project with Root Directory `studio`**. Build command `npm run export:web`, output `dist`.

Do not repoint the original `my-phone-preview-studio` Vercel project to this directory without testing.

## Link an external Expo app

Build that app in its own repository. Run `npx expo export --platform web` and deploy its output to Vercel in its own project. In this Studio add GitHub repository + stable deployment URL. Web preview shows the React Native Web version.

## Link a real Android APK

Build APK in the app's OWN repository using Expo EAS or other build service, then upload to Appetize with user-approved account. Copy its **Share > Embed** link and register it under Android Cloud APK. The cloud session will show the actual native build if Appetize credentials and permissions permit.

Appetize build IDs may be accessible by anyone who knows the link and may incur usage charges. Do not add restricted applications unless their sharing controls are configured appropriately. Updating app code in GitHub does NOT update an already-uploaded APK.

See [architecture](../docs/STUDIO_ARCHITECTURE.md) and [Appetize embedding](https://docs.appetize.io/platform/embedding-apps).

For backup/recovery, iframe-blocking CSP behavior and tests, see [hardening notes](../docs/IFRAME_STORAGE_HARDENING.md).
