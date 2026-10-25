# SECURITY_ARCHITECTURE — My Phone Expo Studio

**Lidhja operative:** [regjistri kanonik](SECURITY_REGISTER.md) · [modeli i kërcënimeve](THREAT_MODEL.md) · [testet](SECURITY_TEST_MATRIX.md). Bazuar në Draft PR28 `65e989680e9c6ccec2495b46c62342c483c6c389` (jo `main`). Ky dokument përshkruan **kontrolle ekzistuese dhe kufijtë**, jo certifikatë që ato janë në Production. Për detaje API/arkitekture përdor dokumentet ekzistuese [STUDIO_ARCHITECTURE](../STUDIO_ARCHITECTURE.md), [QUICK_PREVIEW_ZIP](../QUICK_PREVIEW_ZIP.md), [IFRAME_STORAGE_HARDENING](../IFRAME_STORAGE_HARDENING.md), [LIVE_SYNC_V04](../LIVE_SYNC_V04.md), [A03/A04 boundary](../A03_A04_ZIP_PREVIEW_PROOF_BOUNDARIES.md), [Vite isolation proposal](../POF211_ISOLATED_VITE_ARTIFACT_ORIGIN_ARCHITECTURE.md) — mos dyfisho specifikimet.

## Diagrami i kufijve të besimit (arkitektura aktuale)

```text
  USER / BROWSER (Studio Expo React Native Web)
        | localStorage: only project metadata + explicit backup/recovery
        | user-chosen ZIP from disk (File in RAM; not uploaded)
        v
  ZIP inspector (central directory, path/type/size checks)
        | trusted PREBUILT Web ZIP only
        v
  Quick Preview assembler (bounded JS/CSS/images, CSP meta, srcDoc)
        | iframe sandbox=allow-scripts; opaque origin
        +----X parent DOM / localStorage / top navigation / popup
        +----! own iframe navigation may trigger network; CPU not isolated
        |
        +-- [remote HTTPS iframe links from configured projects]
                | third-party JavaScript, cookies/service workers, mutable bytes
                | /build-info.json HTTPS bounded read + abort (Live Sync)
                +-- external Web hosting / Appetize (NO Studio attestation)
  
  GitHub repo / CI trust boundary (read-only pinned Actions)
        | npm lockfile, Expo CLI, node_modules build tools (Zod)
        +-- code/test artifact (synthetic ZIP only in public validation)
  
  Vercel Studio deployment / platform identity boundary
        | protected Preview != Production
        +-- future GitHub/Appetize auth requires NEW architecture/authorization
  
  Separate my-phone-pof-validation (independent synthetic proofs; read-only)
```

## 1) ZIP import dhe Quick Preview — kufijtë realë

- `studio/src/zip-inspector.js`: read-only central-directory inspector. Kufizon **32 MiB ZIP**, **5,000 entries**, **512 MiB** total declared uncompressed; refuzon emra që dalin nga rrënja, path traversal, symlinks, ZIP64/encryption dhe disa struktura të pavlefshme. **Metadata e deklaruar nuk është garanci ndaj të gjithë ZIP bombs**.
- `studio/src/quick-preview.js`: lejon vetëm strukturë build statik që përputhet me profilin e mbështetur; max HTML **256 KiB**, JS **8 MiB**, CSS totale **2 MiB**, deri në 4 stylesheets, deri në **24** asete lokale nga **512 KiB** secili dhe **3 MiB** total. Disa variante Expo përdorin rrugë të veçanta për asete PNG; zbatojnë kufizime dhe CSP. Mbikëqyrja e gjithë CPU-së/memories/koha e dekompresimit **nuk është e provuar**. Browser nuk ofron preemption të sigurt të JavaScript armiqësor brenda një procesi të përbashkët.
- `studio/src/ZipImportPanel.web.tsx`: përdor përzgjedhës skedarësh lokal. Kodi i ZIP-it në Quick Preview mund të ekzekutohet **vetëm** kur përdoruesi zgjedh ZIP të ndërtuar paraprakisht dhe të besuar. Nuk instalohen varësi të ZIP-it me npm; nuk fillon backend; nuk ka konvertim automatik ZIP të kodit burimor në APK.
- `<iframe sandbox="allow-scripts">` pa `allow-same-origin`, `allow-top-navigation` dhe `allow-popups` krijon origjinë opake për srcDoc. CSP kufizon `connect-src`, `form-action`, `object-src`, `frame-src` dhe `worker-src`. **Kufizim kritik i provuar:** JS mund të navigojë *vetë* iframe-in në një adresë HTTPS duke nisur kërkesë rrjeti; nuk ka kontroll të garantuar zero-egress. Navigimi i top/parent u refuzua në provat e A03.
- Rrugët e daljes nga Quick Preview duhet të anulojnë ticket/epoch, të pastrojnë referencat e iframe-it dhe të mbajnë preview-t në RAM; testet e PR21/24/25 mbulojnë ndërrime konteksti/race. Kjo nuk garanton përfundim të CPU-bound decompression të nisur.
- **Ndalim operacional:** kod i panjohur/armiqësor nuk duhet të ngarkohet si Quick Preview. Për ta mbështetur do të kërkohej origin i dedikuar me CSP të zbatuar nga **serveri** (jo vetëm meta), rrjet i kufizuar, proces/CPU/memorie/kohë të kufizuara, zero secrets, kontrolle anti-CSRF/session dhe auditim i ri. Projekti ka vetëm kontratë arkitekturore për këtë, **jo implementim**.

## 2) Web, Live Sync dhe Android Cloud

- URL-të Web duhet të kalojnë validimin HTTPS të `studio/src/project-model.js`; `studio/src/live-sync.js` ndërton manifest URL pa kredenciale të futura në URL. PR22 vendos kufi **8,192 bytes** për Web URL. URL host lejon domain publik të konfiguruar nga përdoruesi; **nuk është endpoint i besuar automatikisht**.
- Live Sync kontrollon `/build-info.json` afërsisht çdo **15s**, timeout **8s**, max stream **16,384 bytes UTF-8**; lexuesi aborton fetch + anulon stream kur header/bytes tejkalojnë limitin; trupi dhe manifesti validizohen. Kërkesat e vjetra injorohen pas ndërrimit të kontekstit.
- `Session Freeze` ndalon vetëm ri-ngarkimin e iframe **nga Studio**, jo byte-t në server, fetch-et e embedded app, service worker, cookie state apo script-in e jashtëm. Një status manifest `revision`/iframe `load` **nuk provon** që një build/deployment real ka kaluar CI. Web/Android Cloud previews janë palë të treta me politika të veta.
- Për URL-të e jashtme dhe embed-et, mos u jep tokenë Studio, mos i trajto si same-origin dhe respekto CSP/X-Frame-Options të serverit tjetër. Nuk kryhen operacione administrative te Appetize/Vercel/GitHub pa autorizim.

## 3) Metadata, localStorage dhe privatësia

- `studio/src/project-storage.js` validon listën maksimum **100** projekte, backup JSON max **200,000 bytes UTF-8**; import/export me format/version të kontrolluar. Refuzon shkrimin e listës së pavlefshme; nuk fshin automatikisht registry të korruptuar. `ORIGINAL_REGISTRY_KEY` ruan origjinalin para rikthimit **të konfirmuar** nga përdoruesi. Kjo është kopje në **të njëjtën origjinë/localStorage**, jo backup jashtë pajisjes.
- Nuk ruhen ZIP-et në regjistër si feature i produktit; mos ruaj tokens, cookies, API keys, private ZIP, informacione personale apo dokumente sensitive në localStorage ose artifact-et e CI. Browser storage mund të fshihet, bllokohet nga quota/private browsing ose aksesohen nga skripte me të njëjtin origin.
- Eksporti i backup-it kalon nga zgjedhja e përdoruesit dhe kërkon ruajtje të sigurt nga ai. Testet sintetike përdorin të dhëna fiktive. As screenshot/log/trace publik nuk duhet të përmbajë identifikues apo secrets reale.

## 4) Build, CI, zinxhiri i furnizimit dhe cloud

- Kodi i Studios: `studio/`, React Native Web / Expo. Node/npm lockfile siguron instalime të riprodhueshme me `npm ci`. GitHub Actions standard [`.github/workflows/studio-verify.yml`](../../.github/workflows/studio-verify.yml): permissions `contents:read`, action SHA të fiksuara, credentials checkout të çaktivizuara, `npm ls`, fail-closed `verify-security-audit.mjs`, Node, TypeScript, Expo Web export, licenca/notices, Playwright desktop/mobile.
- Një pjesë e varësive në procesin e **ndërtimit/zhvillimit** nuk futen në bundle Web. [proof #40040535523](https://github.com/titanfit102-bit/My-phone/actions/runs/40040535523): 161 source-map paths të kontrolluara, **0 Zod, 0 Expo CLI server module** dhe 1 Metro loader normal. Kjo provë është vetëm për export-in Web të ekzaminuar, **jo** për CLI server/native/dynamic branches.
- A05 Zod DoS mbetet **gate FAILED** në [#40178543555](https://github.com/titanfit102-bit/My-phone/actions/runs/40178543555). `@expo/cli` nga SDK57/58 kërkon Zod3; [Zod GHSA](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) shënon 4.6.6 patched, ndërsa [CNA](https://cve.circl.lu/vuln/ghsa-mrhx-c7xc-m3w5) vëren rrezikun e mbetur të unbounded containers. Forcimi i Zod4 në PR23 **nuk është i miratuar** nga kontrata Expo; mos e përdor për të anashkaluar gate.
- `docs/POF211_ISOLATED_VITE_ARTIFACT_ORIGIN_ARCHITECTURE.md` përshkruan një opsion **të ardhshëm**, jo host të aktivizuar. Nuk hapim automatizime Vercel/GitHub me privilegje apo shërbime me pagesë.
- Branch protection/required checks në GitHub: ekzistenca dhe enforcement janë **UNKNOWN** (API administrative 403). Propozimi: kërko auditin zyrtar, testet dhe review para merge në `main`, jo ndryshim administrativ nga ky Draft.

## 5) Cicli operacional i mbrojtjes

1. Lexo checkpoint `docs/CURRENT_STATE.md`, handoff dhe [SECURITY_REGISTER](SECURITY_REGISTER.md) në degët e tyre kanonike; verifiko live HEAD. Mos përdor historik të vjetruar si provë.
2. Klasifiko ndryshimin sipas `SECURITY_TEST_MATRIX.md`: UI i thjeshtë / logjikë / ZIP-iframe-LiveSync-deps / release. Ekzekuto **vetëm testet relevante** për riskun, përveç release-it që kërkon të gjitha.
3. Mos fut secrets në branch, prompt, log ose artifacts. Mos përdor ZIP privatisht për prova publike. Në teste negative përdor fixture sintetike + mock/intercept të rrjetit, jo host real të të tretëve.
4. Shëno `IMPLEMENTED`, `TESTED`, `PUBLISHED`, `VERIFIED SECURITY` si dimensione të ndryshme. Përpara përditësimit të statusit cito run, SHA/PR, rezultatet negative dhe limitet.
5. CI security **FAILED** = release NO-GO pavarësisht CI funksionale SUCCESS; agjentët nuk bëjnë merge/deploy, nuk ndryshojnë exceptions ose admin settings pa miratim. Vetëm dokumentet e vazhdimësisë autorizohen të përditësohen automatikisht sipas protokollit ekzistues.

**Ky dokument nuk është mekanizëm enforcement vetvetiu:** mekanizmat janë validimet në kod, testet e ekzekutuara dhe GitHub required checks **nëse admini i aktivizon**. Për mënyrën e përdorimit nga agjentët shih [`AGENTS.md`](../../AGENTS.md), i propozuar vetëm në degën Draft të këtij programi.
