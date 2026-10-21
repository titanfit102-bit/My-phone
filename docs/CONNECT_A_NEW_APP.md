# Lidh një aplikacion të ri me My Phone Expo Studio

Çdo aplikacion që shfaqet në Studio ka repository, deployment dhe testet e veta. **Mos kopjo kodin e aplikacionit brenda `My-phone`.**

## 1. GitHub i aplikacionit

Krijo ose përdor repository-n e vetë aplikacionit (p.sh. `yourname/dating-app`). Kodi dhe konfigurimet e tij mbeten atje. Një demo që ekziston vetëm në një bisedë duhet së pari të ndërtohet dhe publikohet si aplikacion.

## 2. Publikimi web i aplikacionit

Publiko versionin web në Vercel ose në një host tjetër HTTPS. Përdor URL-në e qëndrueshme të projektit, jo URL-në e një deployment-i të vetëm. Për React Native + Expo mund të eksportosh web me `npx expo export --platform web`, pastaj të publikosh output-in përkatës.

## 3. Shto aplikacionin në Expo Studio

Hap **website-in e Expo Studio** (projekti Vercel me Root Directory `studio`), kliko **+ Shto**, dhe regjistro:
- emrin e aplikacionit;
- lidhjen e repository-t GitHub, nëse e ke;
- URL-në HTTPS të versionit web dhe/ose URL-në zyrtare Appetize Embed të APK-së.

Për preview nevojitet të paktën një URL funksionale web ose Android Cloud. Lista e projekteve ruhet në `localStorage` të atij shfletuesi, jo në GitHub dhe as në pajisje të tjera. Përdor **Eksporto backup JSON** para pastrimit të të dhënave të browser-it dhe **Importo backup JSON** për rikthim.

## 4. Përditësime nga GitHub në preview

Ndryshimet bëhen dhe testohen në repository-n **e aplikacionit**, jo në `My-phone`. Pasi hosti të publikojë versionin e ri, Expo Studio mund të shfaqë versionin e publikuar në Web Preview.

Për monitorim më të besueshëm, aplikacioni i publikuar duhet të ofrojë `GET /build-info.json` në rrënjën e domenit:

```json
{"revision":"a1b2c3d4","builtAt":"2026-10-20T15:00:00Z"}
```

`revision` duhet të jetë identifikues jo sekret i versionit. Lejo CORS për origin-in e Studio, kur është e përshtatshme. Studio kontrollon metadata çdo **15 sekonda** sa kohë është aktive; rifreskon iframe vetëm kur identifikon një version të ri, përveç rasteve kur ke aktivizuar Session Freeze. Pa metadata të vlefshme, mund të përdorë rifreskimin rezervë çdo **60 sekonda**, pa pretenduar që ka verifikuar build-in.

Për aplikacione Vite/React me output `dist/`, shiko shembullin [emit-build-info](../templates/emit-build-info.mjs). Detajet janë te [Live Sync v0.4](LIVE_SYNC_V04.md).

## 5. Preview i një APK-je reale (opsional)

APK-ja ndërtohet në repository-n e aplikacionit me Expo EAS ose me një shërbim tjetër të autorizuar. Ngarkimi i build-it në Appetize kërkon llogari dhe leje të veçantë; mund të ketë kosto. Regjistro URL-në **Share > Embed** për build-in e saktë në Expo Studio dhe nis manualisht sesionin Android Cloud. **Ndryshimi i kodit në GitHub nuk përditëson vetvetiu APK-në e ngarkuar.**

## Kufizime dhe siguri

- Studio nuk bën deploy automatik vetëm nga lidhja e GitHub.
- Një `build-info.json` i vlefshëm konfirmon identifikuesin e versionit të publikuar, jo kalimin e testeve private të CI.
- Disa faqe ndalojnë shfaqjen në iframe me CSP/`X-Frame-Options`; përdor **Hap jashtë studios**.
- Mos vendos sekrete, API tokens ose kredenciale në URL, `build-info.json` apo në frontend.
- Konfigurimet lokale të Studio dhe APK-të cloud janë të ndara; ruaj backup dhe kontrollo kostot e Appetize.
