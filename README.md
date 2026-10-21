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

## Quick Preview ZIP — faza për ZIP-et me Web build

Në sidebar përdor **↑ Ngarko ZIP**. Studio kontrollon ZIP-in lokalisht, kërkon `dist/index.html` (ose `build/out`) dhe një bundle JS të vetëm me maksimumi një CSS. Nëse gjendet, e çkompreson **vetëm përkohësisht në shfletues** dhe shfaq pamjen në telefonin virtual në një `iframe` të izoluar (pa same-origin). **Nuk ruan ZIP-in ose preview-n në My Projects, localStorage apo databazë**. Butoni **✕ Mbyll Quick Preview** e mbyll menjëherë; rifreskimi ose mbyllja e faqes e humbet sesionin.

Për këtë modalitet nuk ka nevojë për pagesë cloud, instalim në kompjuter apo akses në GitHub. **Nuk është build automatik**: ZIP që përmban vetëm kod burimor kërkon build më vete. Preview është offline dhe API/backend, fontet/media të jashtme, module të ndara ose APK reale mund të mos funksionojnë. Përdor `Quick Preview` vetëm për build-et Web që i njeh. Shih [kufizimet dhe testet](docs/QUICK_PREVIEW_ZIP.md).

## ZIP Import — faza 1 (analizë e sigurt, jo build)

Në sidebar ekziston **↑ Ngarko ZIP** për të zgjedhur arkivin e shkarkuar nga GitHub main. Studio analizon vetëm indeksin/strukturën e ZIP-it lokalisht, zbulon me indikacione framework-un dhe dallon kodin burimor nga kandidati për build Web statik. **Nuk nxjerr, ekzekuton, ruan apo ngarkon kodin në server. Nuk prodhon ende preview nga ky ZIP.** Kufijtë: ZIP maksimal 32 MB, 5000 hyrje, 512 MB madhësi e deklaruar e çkompresuar; arkivat me emra të pasigurt, lidhje simbolike, ZIP64 apo enkriptim refuzohen. Kjo aftësi nuk kërkon kredenciale GitHub dhe nuk prek projektet e tjera.

**Faza 2 (nuk është implementuar):** mjedis build-i i izoluar me autorizim dhe kufi shpenzimesh; publikim i versionit Web te një host i veçantë ose APK në Android Cloud, pastaj lidhja automatike e preview-t.

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
