# My-phone · Preview Studio

Një Chrome Extension për shumë aplikacione: zgjidh një projekt, lidhe me repository-n e tij GitHub dhe me URL-në e aplikacionit të publikuar, pastaj shiko versionin më të fundit në një panel në formë telefoni.

## Për çfarë shërben?

`GitHub (kodi i app-it) → Vercel (deployment) → My Phone (preview)`

My Phone është menaxher demonstrimesh, **jo** repository ku vendosim kodin e çdo aplikacioni. Çdo aplikacion ka kod dhe deploy të vetin. Mund të punosh në biseda të ndryshme ChatGPT; kushti është që ndryshimet të ruhen në të njëjtin repository të aplikacionit.

## Statusi

- UI për shumë projekte: shto, zgjedh, modifiko, hiq nga lista lokale.
- Preview në Chrome Side Panel dhe buton për hapje në tab.
- Ruan projektet në `chrome.storage.local` (pa API keys).
- Kërkon leje sipas origjinës së demos, jo qasje automatike te të gjitha faqet.
- Kontrollon `/build-info.json` çdo ~15 sek. dhe e rifreskon demon pas një deployment-i të ri.
- Pa metadata, përdor rifreskim rezervë çdo ~60 sek.
- Një `web/` demo e pavarur dhe e ripërdorshme, për të testuar sistemin.
- Testet e projektit mund të ekzekutohen me Node dhe në GitHub Actions.

Nuk e kemi verifikuar ende përmes instalimit real në Chrome ose me një deploy të përfunduar Vercel. Mos e ngatërroni ekzistencën e kodit me suksesin operacional.

## Instalimi për përdorim personal

1. Shkarko repository-n e `My-phone` nga GitHub (`Code → Download ZIP`) dhe nxirre ZIP-in.
2. Hap Chrome → `chrome://extensions`.
3. Aktivizo `Developer mode`.
4. Kliko `Load unpacked` dhe zgjidh dosjen `extension` brenda projektit të nxjerrë.
5. Hap panelin nga ikona My Phone.
6. Shto projektin tënd duke vendosur GitHub URL dhe **URL e publikuar HTTPS** nga Vercel, pastaj prano lejen e Chrome.

Për udhëzime për çdo aplikacion të ri: [docs/CONNECT_A_NEW_APP.md](docs/CONNECT_A_NEW_APP.md).

## Zhvillimi lokal

Kërkohet Node.js 20+:

```bash
npm test
npm run build
npm run dev
```

Demo lokale: `http://127.0.0.1:4173/`. Build-i statik është në `dist/`.

## Publikimi i vetë demos testuese në Vercel

Importo repository-n `titanfit102-bit/My-phone` si projekt Vercel. Zgjidh **Other** si framework, root `./`, build command `npm run build`, output directory `dist`. Përdor URL-në stabile të projektit.

## Kufijtë e funksionimit

- Vetëm një deployment i përfunduar mund të shfaqet; My Phone nuk e kompilon kodin direkt nga GitHub.
- Pa një API të dedikuar, lidhja repository ↔ preview vendoset manualisht një herë.
- My Phone nuk kopjon demonstrime të brendshme të ChatGPT automatikisht; ato duhen vendosur në repository-n e aplikacionit.
- Iframe mund të bllokohet nga politikat e faqes. Ekziston fallback **Hap në tab**.
- Versioni i ri i vetë Chrome Extension nuk instalohet automatikisht nga GitHub; reload/riinstalim manual për kode të reja.
- Demo web nuk është ende një aplikacion Android/iOS i përfunduar.

## Organizimi

- `extension/` — Chrome Extension MV3 me menaxher projektesh dhe preview.
- `web/` — demonstrim web i pavarur, jo i bllokuar te extension.
- `scripts/` — build dhe dev server.
- `templates/` — adaptor opsional për metadata në aplikacione të tjera.
- `docs/` — udhëzime lidhjeje.
- `tests/` — validime dhe teste.
- `.github/workflows/verify.yml` — CI.

Të gjitha ndryshimet në këtë repository janë të izoluara nga projektet e tjera.
