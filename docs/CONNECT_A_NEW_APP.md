# Lidh një aplikacion të ri me My Phone

Për çdo aplikacion përdor një repository të veçantë. My-phone nuk kopjon apo ndryshon kodin e aplikacioneve të tjera.

## 1. GitHub
Krijo repository-n e aplikacionit, p.sh. `yourname/dating-app`. Vendos aty kodin real të frontend-it. Demonstrimet që ekzistojnë vetëm brenda një bisede ChatGPT duhet të eksportohen në repository përpara se My Phone t'i shfaqë.

## 2. Vercel
Importo atë repository në Vercel. Verifiko që build-i përfundon me sukses dhe hap URL-në e qëndrueshme të projektit (p.sh. `https://dating-app.vercel.app/`). Mos përdor URL të një deployment-i të vetëm, sepse ai nuk ndryshon me commit-et e ardhshme.

## 3. My Phone
Hap extension-in, shtyp **+**, plotëso:
- emrin e aplikacionit;
- URL e plotë e GitHub, p.sh. `https://github.com/yourname/dating-app`;
- URL e demos së publikuar, p.sh. `https://dating-app.vercel.app/`.

Chrome kërkon leje vetëm për origin-in e demos. Pasi ta miratosh, My Phone e ruan lidhjen në këtë profil Chrome. Kërkimi në GitHub për projektin dhe deploy në Vercel janë procese të ndara; extension-i nuk mund të krijojë automatikisht një deployment vetëm nga URL e repository-t.

## 4. Përditëso nga cilado bisedë ChatGPT
Në bisedë specifiko repository-n **e aplikacionit**, jo `My-phone`. Kërko që ndryshimet të bëhen në atë repository me GitHub të lidhur dhe testime përpara publikimit. Sapo Vercel të publikojë branch-in përkatës, My Phone e rifreskon demon.

## Strategjitë e sinkronizimit
**Më e sakta:** aplikacioni duhet të publikojë `/build-info.json` me `revision` dhe opsionalisht `builtAt`:

```json
{"revision":"a1b2c3d4","builtAt":"2026-10-20T15:00:00Z"}
```

My Phone kontrollon metadata afërsisht çdo 15 sekonda, sa kohë që paneli është i hapur. Kur ndryshon revision ose builtAt, rifreskon iframe-in.

Për aplikacione Vite / React që prodhojnë dosjen `dist/`, mund të kopjosh `templates/emit-build-info.mjs` në projektin e tyre dhe pas `vite build` të ekzekutosh `node scripts/emit-build-info.mjs dist`. Për Next.js, gjeneroje skedarin në `public` përpara `next build`.

**Rezervë universale:** nëse aplikacioni nuk ka metadata, My Phone rifreskon demon afërsisht çdo 60 sekonda. Mund të shfaqë versionin më të fundit vetëm pas publikimit dhe rifreskimit, dhe nuk pretendon të verifikojë SHA-në pa metadata.

## Kufizime të rëndësishme
- GitHub nuk ekzekuton automatikisht aplikacionet web; nevojitet host publikimi (Vercel, Netlify, etj.).
- Projekti privat në GitHub mund të ketë demo publike, por nuk do të thotë që kodi privat bëhet publik. Mos vendos sekrete në frontend.
- Disa faqe ndalojnë iframes me `X-Frame-Options` ose `Content-Security-Policy: frame-ancestors`. Në atë rast përdor **Hap në tab**.
- Login, cookies dhe popups mund të mos funksionojnë në iframe për shkak të kufizimeve të shfletuesit.
- Chrome Extension nuk lexon automatikisht përmbajtjen e bisedave ChatGPT.
- Ndryshimi i vetë kodit të extension-it në GitHub kërkon instalim/përditësim të extension-it; **vetëm demonstrimet** sinkronizohen automatikisht.
