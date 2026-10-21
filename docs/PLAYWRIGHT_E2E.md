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
- Tests cover project CRUD, reload persistence, invalid URLs, a simulated /build-info.json revision change, and fallback on 404.
- All external app pages are intercepted with Playwright routes under **https://preview.example.test/**. No ILLYRIAN URL is requested.
- A passing E2E test only verifies these flows with the controlled mock. It does **not** prove every third-party iframe accepts embedding (CSP), a real Vercel deploy transition, or the Appetize Android device.
- Chrome may reject embedding at other origins due to CSP/X-Frame-Options; prove this separately against an explicitly permitted test project.
- Browser traces and screenshots are uploaded by CI if an E2E test fails.
- Live Sync manifest polling is every 15 seconds; the version-change test uses a real browser clock, not a fake.
