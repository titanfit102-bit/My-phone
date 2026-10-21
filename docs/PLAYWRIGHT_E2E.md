# My Phone Studio — Playwright browser acceptance tests

Scope: **central Studio only**, against the built static Expo Web app; no changes or requests to real application repositories.

```bash
cd studio
npm ci
npx playwright install chromium
npm run export:web
npm run test:e2e
```

- Desktop Chromium 1366x900 and mobile-sized Chromium 390x844.
- Tests cover project CRUD, reload persistence, invalid URLs, a simulated /build-info.json revision change, fallback on 404, Session Freeze, failed localStorage writes, export/import backup and simulated CSP/X-Frame-Options frame blocking.
- All external app pages are intercepted with Playwright routes under **https://preview.example.test/**. No ILLYRIAN URL is requested.
- A passing E2E test verifies these flows with the controlled mock; Chromium does enforce CSP and X-Frame-Options in the negative test fixtures. It does **not** prove a real third-party iframe will embed, an actual Vercel A/B deployment transition, or Appetize Android device functionality.
- Real application embedding and deployment changes require separate, explicitly authorized browser acceptance tests.
- Browser traces and screenshots are uploaded by CI if an E2E test fails.
- Live Sync manifest polling is every 15 seconds; the version-change test uses a real browser clock, not a fake.
