# WORK → HIGH — My Phone Expo Studio, PR #15

Data: 21 tetor 2026. Mënyra: AUTO, ekzekutim lokal i izoluar + GitHub API + kontroll i pavarur i kodit. Pa shpenzime, merge ose publikim në Production.

## Detyra dhe gjendja fillestare e verifikuar

- Repository privat: `titanfit102-bit/My-phone`.
- PR: [#15](https://github.com/titanfit102-bit/My-phone/pull/15), OPEN/DRAFT, branch `feat/advanced-zip-local-assets`, me bazë `feat/my-phone-engine-v1-core` (PR #14).
- HEAD fillestar: `ba2a5c02afd12b5be862832022f5a5529dfdd3ea`; baza e PR: `2b9ddd14484a056f370560e134491ba24006c595`.
- Transporti Git nuk kishte autentikim lokal. U lexuan 48 skedarët përmes GitHub API dhe u verifikua hash-i Git i secilit kundrejt pemës së commit-it: **48 përputhje, 0 mospërputhje**. Nuk kishte AGENTS.md në pemë. Snapshot-i lokal nuk u publikua si histori e re; commit-i në GitHub ruan prindin origjinal.
- Baseline lokal: 63/63 teste Node PASS, TypeScript PASS, Expo Web export PASS.
- [Preview fillestar](https://my-phone-studio-rkgqk1xu0-un24.vercel.app): metadata Vercel READY, me SHA fillestar të saktë. Ky status provon build-in e deployment-it, jo funksionimin e plotë të faqes.

## Shkaku real i GitHub Actions

[Run 39652994244](https://github.com/titanfit102-bit/My-phone/actions/runs/39652994244) dështoi përpara hapave. Njoftimi në faqen e GitHub thotë se job-i nuk nisi për shkak të pagesave ose spending limit.

Verifikimi i llogarisë e konkretizoi shkakun:

- [Billing Overview](https://github.com/settings/billing): **2,000 minuta të përdorura / 2,000 minuta të përfshira**, pra 0 minuta të mbetura. Ndërfaqja tregonte reset në 11 ditë.
- [Budgets](https://github.com/settings/billing/budgets): buxheti shtesë Actions **$0.00**, status **Usage blocked**.
- [Actions permissions](https://github.com/titanfit102-bit/My-phone/settings/actions): Actions aktive, të gjitha actions/reusable workflows lejohen, GITHUB_TOKEN me leje leximi. Nuk u konstatuan leje që pengojnë këtë workflow.
- [Runners](https://github.com/titanfit102-bit/My-phone/settings/actions/runners): asnjë self-hosted runner i konfiguruar. Workflow përdor `ubuntu-latest`, pra runner-in e GitHub.
- `.github/workflows/studio-verify.yml` është workflow i njohur nga GitHub dhe përmban Node 22, `npm ci`, audit gate, testet Node, TypeScript, export dhe Playwright. Njoftimi për migrimin Ubuntu 26 është NOTICE, jo shkaku i dështimit.

Nuk u ndryshuan workflow, billing, spending limits, leje ose runner-a. Korrigjimi i kodit nuk mund të krijojë minuta të reja falas. Nuk u bënë rerun-e të përsëritura ndaj të njëjtit bllokim. Nuk ka prova nga ky kontroll për një pagesë konkrete të dështuar; faktet e mjaftueshme janë kuota e shteruar dhe buxheti $0.

## Ndryshimet e realizuara

1. **Kufi 8 MiB për CSS-në e gjeneruar**, i përbashkët për të gjitha stylesheets. Numëron çdo referencë të përsëritur, edhe kur figura vjen nga cache, dhe UTF-8 pas escapimit të `</style`. Kjo mbyll amplifikimin e payload-it nga përsëritja e një figure të madhe.
2. **CRC32 për çdo skedar të përzgjedhur që nxirret**. Kontrollon përputhjen e flags, metodës, madhësive dhe CRC mes local header dhe central directory; payload-i nuk lejohet të kalojë brenda central directory.
3. **Ndalim i hershëm i Deflate** kur rezultati kalon madhësinë e deklaruar ose kufirin e nxjerrjes. Ruhet mbështetja e ZIP-ve me data descriptors.
4. Fixture ZIP me CRC reale; regresione për korrupsion, metadata të falsifikuara, madhësi të deklaruara të rreme, kufij CSS/assets dhe amplifikim pas escapimit.
5. Test shfletuesi me **font WOFF real** dhe figurë që dekodohet realisht, përveç computed styles dhe CSS-ve të shumta. Fonti testues është subset DejaVu Sans me licencën përkatëse në repository.
6. Test desktop/mobile për origjinën opaque, bllokimin e parent DOM, fetch, figurave të jashtme, popups dhe fshirjen e storage të përkohshëm pas close/reopen.
7. Dokumentacion për kufijtë realë të sigurisë, planin e ekzekutimit dhe evidencën e verifikimit.

Nuk u ndryshuan arkitektura, UI, dependency manifest/lockfile, ofruesit cloud, secrets, modalitetet ekzistuese apo repository të tjera.

## Testet dhe provat

Evidenca e strukturuar, emrat e testeve dhe hash-et e burimit: [PR15_2026-10-21.json](verification/PR15_2026-10-21.json).

| Kontrolli | Rezultati final |
|---|---|
| `npm ci --ignore-scripts --no-audit --no-fund` | PASS; 505 packages. Lockfile nuk ka paketa me install scripts. |
| `npm ls --depth=0` | PASS |
| Node tests, Node 24.19.0 | **71 PASS / 0 FAIL / 0 skipped** |
| Node tests, Node 22.23.3 (familja e CI) | **71 PASS / 0 FAIL / 0 skipped** |
| TypeScript 5.9.3, Node 22 dhe 24 | PASS |
| Expo Web export, Node 22 dhe 24 | PASS; i njëjti bundle `AppEntry-500b5496abf1fc952e218694472a3a18.js` |
| Playwright 1.64.1 desktop + mobile | **35 PASS / 0 FAIL / 1 skipped / 0 flaky**, pa retries |
| Audit gate ekzistues | PASS me përjashtimet ekzistuese; **15 High / 3 Moderate / 0 Critical** |
| `git diff --check` | PASS |
| GitHub-hosted CI për ndryshimet | **BLOCKED / NOT RUN** nga kuota; nuk pretendohet CI green |
| Browser me versionin standard Chromium 156 të Playwright | **NOT RUN**; shkarkimi në këtë mjedis dështoi |
| ZIP real përfaqësues i përdoruesit | **NOT RUN**; provat e këtij ekzekutimi përdorin fixtures të kontrolluara |
| APK real / Appetize | **NOT RUN**; jashtë ndryshimit të PR #15 |

Playwright u ekzekutua me Chromium **153.0.8010.0**, binar npm `@sparticuz/chromium@153.0.0`, i instaluar vetëm si mjet testimi jashtë repository-t. U ndryshua përkohësisht vetëm executable/launch options, 2 workers dhe 0 retries. **Nuk** u përdorën flags që çaktivizojnë web security, CSP ose same-origin checks. Config-u CI mbeti i pandryshuar. Testi desktop-only i telefonit fiks anashkalohet qëllimisht në projektin mobile.

Regresionet e amplifikimit, CRC/header dhe escapimit u panë të dështonin para korrigjimit dhe të kalonin pas tij. Review i pavarur: pa gjetje High/Medium; një gjetje Low për numërimin para escapimit u riprodhua dhe u korrigjua para suite-s finale.

## Siguria dhe kufizimet e hapura

- Sandbox `allow-scripts` pa `allow-same-origin` dhe CSP ekzistuese u ruajtën; sjelljet e përmendura u testuan në shfletues.
- CRC32 garanton kontroll korrupsioni, **jo** autenticitet ose kod të padëmshëm.
- Preview mbetet për build-e të besuara. JavaScript arbitrar mund të konsumojë CPU/memorie ose të tentojë të navigojë iframe-in e vet. CSP për fetch/subresources nuk është garanci që çdo formë e trafikut është e pamundur.
- **15 High dhe 3 Moderate mbeten të pazgjidhura.** Audit gate i përjashton përkohësisht advisories e rishikuara deri më 21 nëntor 2026; nuk janë rregulluar nga kjo detyrë.
- Vercel deployment metadata është e lexueshme, por HTTP Preview ridrejton te Vercel Authentication; connector-i i fetch të deployment-it kthen **403 në `read_protection_bypass`**, ndërsa Cloud Browser arrin te login. Runtime dhe `/build-info.json` të Preview-t të publikuar mbeten të paverifikuara. Nuk u çaktivizua mbrojtja dhe nuk u kërkua secret i ri.

## Rekomandimi WORK → HIGH

**Gati për review teknik të kodit; jo gati për merge/Production.** Mbaje PR #15 Draft derisa të verifikohet CI në commit-in final, Preview runtime dhe ZIP përfaqësues. Rishiko advisories para release. Prindërit e stacked PR duhen trajtuar sipas rendit të projektit; ky ekzekutim nuk i ndryshon.

Hapi falas: vazhdo testimin lokal dhe rinis CI pas reset-it të kuotës. Nëse kërkohet CI GitHub menjëherë, nevojitet vendim i veçantë për buxhet shtesë ose një runner të autorizuar; këto nuk u aktivizuan. Për runtime Preview nevojitet qasje ekzistuese Vercel që autorizon projektin/team-in ose hyrje e përdoruesit. Mos rrit lejet ose buxhetin automatikisht.

Branch-i dhe commit-i përfundimtar janë në PR #15; burimi i testuar identifikohet edhe nga hash-et Git të evidencës. Nuk u krye merge dhe nuk u publikua në Production.
