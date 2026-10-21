# My Phone Developer Studio — Architecture & Release Gates

## Product boundary

The **My-phone** repository hosts the central *viewer/studio only*. Never copy an unrelated application's source into this repository.

The only maintained application surface is `studio/` — Expo + React Native Web, deployed to the existing Vercel project `my-phone-studio` at https://my-phone-studio.vercel.app. Legacy Chrome Extension was removed in PR #9 and the standalone `web/` proof of concept is retired. The standalone repository-root web demo and its CI are retired as part of a separately reviewed cleanup. Git history is retained.

Each external app retains its own GitHub repository, hosting configuration, backend, tests, access controls, deployments, APK packages, and ownership.

## Why two preview modes?

| Mode | Source of truth | Render mechanism | What is tested |
|---|---|---|---|
| Expo/Web | The application's deployed HTTPS URL (e.g. Vercel) | HTML iframe in Expo Web app | Frontend browser behavior; React Native Web when that app uses Expo |
| APK cloud | Appetize uploaded Android build, referenced by buildId | Appetize's device iframe | Real Android application running on cloud device |

**The Studio Expo code is NOT the application code being tested.** Expo makes the STUDIO web UI reusable, not automatically turn other HTML projects into Expo.

## Project registry

Browser-local storage key: `my-phone-studio-projects-v1`.

Record: `{id,name,github,web,native}`.

- `github`: exact repository URL; used for opening source/history.
- `web`: deployed HTTPS app URL (optional).
- `native`: Appetize Share > Embed URL for a SPECIFIC published APK build (optional).
- At least one preview link required. No access tokens stored.
- Entries belong to this browser profile; no cross-device sync or backend at this stage.
- A GitHub link alone DOES NOT deploy code or install APKs.

## Web lifecycle

1. Change and test code in that app's own repository.
2. CI and Vercel build/deploy that app on the configured production branch.
3. My Phone Studio polls a public `/build-info.json` every **15 seconds**. A changed revision refreshes the stable Web iframe in automatic mode; in Session Freeze it remains pending until explicitly accepted.
4. When metadata is missing/CORS-blocked, a **60-second fallback refresh** applies only when not frozen. This is not proof of successful private GitHub CI or Vercel deployment. Temporary failed deploys may leave the old version showing.
5. If host sends anti-iframe CSP/X-Frame-Options or auth needs third-party cookies, use 'Hap jashtë studios'.

## Android lifecycle

1. App is developed in React Native + Expo or another Android technology in its own repo.
2. An EAS build or other signing process produces an APK appropriate for Android testing (not an AAB-only store artifact).
3. User or a separately authorized CI workflow uploads the APK to Appetize.
4. Appetize supplies a share/embed URL for the uploaded build.
5. Paste `https://appetize.io/embed/{buildId}` into My Phone Studio's app record. Click 'Android Cloud APK'.
6. Cloud session is initiated manually via Appetize iframe controls. Cloud minutes may incur charges.
7. A newly created APK generally has a NEW buildId. Update the app's native link to test that specific new version.

**Never** expose the Appetize API token in Expo Web, GitHub source or localStorage. Future upload automation must keep credentials in the APP's GitHub Actions secrets or a server-only integration and define spending/access limits. A public Appetize buildId might permit anyone with the URL to run the app; use Appetize's restricted sharing for sensitive private builds.

## Expo deployment

From `studio/`:
```bash
npm ci
npm run check:config
npm run typecheck
npm run export:web
npx playwright install chromium
npm run test:e2e
```
This uses stable Expo SDK 57 with React Native / React Native Web and outputs `studio/dist`.

**Existing Production project**: `my-phone-studio` (Vercel), deploying `studio/` with `npm run export:web` and `dist`. Verified production alias: https://my-phone-studio.vercel.app. Current project metadata reports Node 24.x on Vercel; local minimum in `studio/package.json` is Node 22.13+. Do not create or reconnect another Vercel project for this Studio. Verify source SHA and Production deployment ID at every release.

## Definition of Done

1. GitHub Action `Verify Expo Studio` runs tests, TypeScript and Expo Web static export successfully.
2. Separate Vercel project builds from `studio/` and provides a working stable HTTPS URL.
3. Manual browser test: create/delete/select project, Web loads, auto-refresh shows a new deployed version.
4. Add a test APK build that the user owns in Appetize; embed loads, device launches on user action, navigation works.
5. Verify no APK service tokens leak to client; get explicit approval before incurring paid cloud sessions.
6. Check reliability, privacy, error handling, and version rollback.

The first commit alone is **not** a completed end-to-end system. No other repositories are edited for integration testing without separate authorization.
