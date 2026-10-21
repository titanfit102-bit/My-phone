# Studio iframe and local project registry hardening

## Behavior

The registry still stores **references only** in the browser's localStorage key `my-phone-studio-projects-v1`. It does not synchronize with Chrome Extension, other browsers, or devices.

### Persistence and recovery

- On startup, missing storage is treated as an empty writable list.
- A blocked storage API, invalid JSON, an invalid project row, a duplicate ID, or more than 100 projects is **not silently replaced with an empty list**. An error is shown. The stored bytes are not automatically overwritten; the user may import a validated backup explicitly.
- Failed `setItem` calls (including quota exhaustion) display an alert. Items in the current page remain in memory; without a successful backup they will **not** survive a reload.
- `↓ Eksporto backup JSON` downloads a versioned JSON file containing only the user's saved project links. Check its contents before sharing it, because repository URLs might be private.
- `↑ Importo backup JSON` validates the entire file, including links and IDs. It **merges** new IDs with the current page; existing IDs retain their current values, preventing accidental overwrites. Import writes to storage **before** declaring success.
- Backup import is restricted to 200 KB and at most 100 projects. If storage is unavailable it reports failure and does not claim recovery.
- The Chrome Extension maintains a **separate** storage model. This PR does not claim to synchronize the Studio and Extension.

### iframe policy and limitation

Only validated HTTPS preview URLs or supported Appetize embeds are used. The web iframe retains its existing sandbox and no-referrer settings. The interface explicitly says an **URL is linked but iframe rendering is unverified** and always provides an open-externally action.

A `load` event cannot prove a cross-origin iframe rendered: a site can block embedding through `Content-Security-Policy: frame-ancestors 'none'` or `X-Frame-Options: DENY`. We **do not** display a misleading 'preview loaded' success status and do not try to bypass those headers.

Even with Session Freeze, a third-party frame can navigate or refresh itself. This PR neither weakens its security headers nor changes connected app repos.

## Reproducible verification

```bash
cd studio
npm ci
npm run check:config
npm run typecheck
npm run export:web
npx playwright install chromium
npm run test:e2e
```

Playwright runs Chromium desktop/mobile on a loopback server with only synthetic HTTPS preview URLs. The test matrix includes quota-denied storage, JSON export, invalid registry preservation, restore via a browser file picker, invalid import, CSP frame denial and X-Frame-Options denial. No production site or real connected application's code is altered or contacted.

Remaining work: real target app CSP/configuration acceptance, Chrome Extension installed interactive test, durable cross-device storage sync, and an independent security review before adding privileged integrations.
