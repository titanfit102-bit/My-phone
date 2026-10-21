# My Phone Expo Studio

**Një produkt qendror: My Phone Expo Studio.** Ky repository privat ruan vetëm kodin e Studios dhe udhëzimet e integrimit. Nuk është repository për kodin e aplikacioneve që Studio shfaq.

## Burimi i së vërtetës

- Kodi kryesor: `studio/` — **Expo + React Native Web**.
- Repository: `titanfit102-bit/My-phone`, dega `main`.
- Production: **https://my-phone-studio.vercel.app**; projekti Vercel `my-phone-studio`.
- Konfigurimi për build: `studio/vercel.json`, komanda `npm run export:web`, output `studio/dist`.
- Kontrata për manifest të aplikacioneve të jashtme: `docs/LIVE_SYNC_V04.md`.
- Shembull opsional për ta kopjuar në repository-t e **aplikacioneve të jashtme**: `templates/emit-build-info.mjs`.

**Komponentët legacy janë tërhequr nga produkti:** Chrome Extension u hoq në PR #9; demoja standalone `web/` dhe build-i i saj nuk janë pjesë e Studios. Pas miratimit dhe integrimit të PR-së së pastrimit, këta komponentë nuk janë më pjesë e kodit aktual. Historiku Git ruhet për auditim dhe rikthim.

## Dy mënyrat e preview

| Mënyra | Si funksionon | Kufiri |
| --- | --- | --- |
| **Expo Web Preview** | iFrame me HTTPS URL të versionit web të publikuar të aplikacionit të lidhur; `/build-info.json` kontrollohet çdo 15 sekonda. | Nuk provon statusin privat CI; CSP ose X-Frame-Options mund të bllokojë iframe. |
| **Android Cloud APK** | Pamje për Appetize Embed URL të një APK-je ekzistuese. | Nuk ndërton apo ngarkon APK vetë; sesioni real i Appetize nuk është pranuar ende me test prove. |

**Session Freeze** pengon vetëm rifreskimet nga Studio; nuk ngurtëson kodin e aplikacionit të jashtëm. Për `localStorage` ekziston backup manual JSON; nuk ka ende sinkronizim mes pajisjeve.

## Punë lokale dhe testet

Përdor Node.js `>=22.13`. Për instalim të përsëritshëm:

```bash
cd studio
npm ci
npm run check:config
npm run typecheck
npm run export:web
npx playwright install chromium
npm run test:e2e
```

GitHub Action **Verify Expo Studio** është i vetmi workflow i nevojshëm dhe kontrollon policy audit për varësitë, testet unit, TypeScript, eksportin dhe Playwright Chromium desktop/mobile. Fakti që CI është `SUCCESS` nuk është baraz me verifikim manual në Production apo teste me APK reale.

## Kufijtë dhe autorizimi

Çdo aplikacion lidhet nga repository dhe deployment-i i vet, pa kopjuar kodin brenda këtij repository. Mos e prek ILLYRIAN, PRESSA SMART, BUILDER SYSTEM ose aplikacione të tjera pa autorizim përkatës. Mos kryej merge, deploy, krijim kredencialesh, përdorim të Appetize me pagesë apo ndryshim në Production pa miratim të shprehur.

Dokumente: [Architecture](docs/STUDIO_ARCHITECTURE.md), [Live Sync](docs/LIVE_SYNC_V04.md), [How to connect an app](docs/CONNECT_A_NEW_APP.md), [E2E](docs/PLAYWRIGHT_E2E.md), [Iframe and storage](docs/IFRAME_STORAGE_HARDENING.md), [Security triage](docs/SECURITY_ADVISORY_TRIAGE_2026-10-21.md), [Legacy retirement decision](docs/EXPO_ONLY_DECISION_2026-10-21.md).

**Siguria:** `npm audit` kishte 15 High dhe 7 Moderate, me 0 Critical sipas log-ut të fundit të verifikuar. Kjo **nuk është** audit i pastër; përjashtimet e përkohshme të dy advisory-ve skadojnë më 2026-11-21. Mos i deklaro të korrigjuara.
