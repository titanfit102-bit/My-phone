# My-phone · Preview Studio

Repo qendrore për demonstrime të izoluara të aplikacioneve të ndryshme. **Mos vendos kodin e një aplikacioni tjetër këtu.**

## Dy ndërfaqe të pavarura

- **`extension/` — My Phone Chrome Extension v0.2**: ruan lidhjet e aplikacioneve GitHub + Web, shfaq demonstrimet e publikuara në Chrome Side Panel.
- **`studio/` — My Phone Expo Developer Studio v0.3**: aplikacion i ri React Native + Expo për Web, me dy mënyra testimi: (1) Web Preview për demo të publikuara; (2) Android Cloud APK Preview për build-e të regjistruara në Appetize.
- **`web/`**: shembulli origjinal i vogël i aplikacionit web për prova. Shërbimi ekzistues i Vercel për këtë shembull mbetet i pandryshuar.

`studio/` duhet publikuar në një **projekt të ri** Vercel, me Root Directory `studio` dhe build `npm run export:web`. Aplikacionet e tjera përdorin repository dhe deployment të veçantë.

Dokumentim:
- [Studio Architecture](docs/STUDIO_ARCHITECTURE.md)
- [Expo Studio Readme](studio/README.md)
- [Lidh një aplikacion të ri me Chrome Extension](docs/CONNECT_A_NEW_APP.md)

## Testet

Për komponentët origjinalë:
```bash
npm test && npm run build
```

Për Expo Studio:
```bash
cd studio
npm install
npm run check:config
npm run typecheck
npm run export:web
```

Cloud Android është integrim me Appetize: ka nevojë për APK të ndërtuar nga aplikacioni, një llogari Appetize dhe një URL zyrtare Embed. Studio nuk gjeneron vetë APK dhe nuk aktivizon sesione me pagesë. Token-et API nuk ruhen në browser.

**Release gate:** code + GitHub tests `≠` prova reale e publikuar; Expo Web dhe Appetize duhen testuar veçmas në një browser/pajisje reale.
