# My-phone · Preview Studio

Repo qendrore për demonstrime të izoluara të aplikacioneve të ndryshme. **Mos vendos kodin e një aplikacioni tjetër këtu.**

## Komponentët e repository-t

- **`studio/` — My Phone Expo Developer Studio v0.4**: React Native + Expo Web me Live Sync për versionet e publikuara, rifreskim rezervë për aplikacionet pa metadata, dhe Android Cloud APK Preview për build-e të regjistruara në Appetize.
- **`web/`**: shembulli origjinal i vogël i aplikacionit web për prova. Shërbimi ekzistues i Vercel për këtë shembull mbetet i pandryshuar.

`studio/` duhet publikuar në një **projekt të ri** Vercel, me Root Directory `studio` dhe build `npm run export:web`. Aplikacionet e tjera përdorin repository dhe deployment të veçantë.

Dokumentim:
- [Studio Architecture](docs/STUDIO_ARCHITECTURE.md)
- [Live Sync v0.4 — kontrata dhe verifikimi](docs/LIVE_SYNC_V04.md)
- [Expo Studio Readme](studio/README.md)
- [Lidh një aplikacion të ri me Expo Studio](docs/CONNECT_A_NEW_APP.md)

## Testet

Për demonstrimin origjinal web:
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

**V0.4 shfaq vetëm versionin e publikuar dhe nuk pretendon të lexojë statusin privat të GitHub Actions pa integrim autentikimi.**

**Release gate:** code + GitHub tests `≠` prova reale e publikuar; Expo Web dhe Appetize duhen testuar veçmas në një browser/pajisje reale.
