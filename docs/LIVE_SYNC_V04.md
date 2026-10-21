# Live Sync v0.4 — contract and verification

## Problem solved

Before v0.4 the Expo Studio simply reloaded any connected webpage every 30 seconds, including when no new deployment existed. This was not build-state monitoring.

v0.4 reads the **published app's** `GET /build-info.json` every 15 seconds, using a no-cache request with an 8-second timeout. In automatic mode it reloads when the revision or build timestamp changes. In **Session Freeze** mode it continues checking metadata but does not reload the embedded preview until the user explicitly accepts the pending release. The user can manually refresh at any point.

## Manifest contract

Publish this JSON file at the root of EACH APPLICATION'S OWN deployed domain:

```json
{
  "revision": "a1b2c3d4",
  "builtAt": "2026-10-20T20:00:00.000Z"
}
```

- `revision`: required stable deployment/build identifier with 1–128 alphanumeric, dot, dash or underscore characters.
- `builtAt`: optional ISO timestamp; helps distinguish rebuilt deployments using an unchanged commit.
- Do NOT put secrets, app tokens, internal repo data or user information here.
- Serve `Content-Type: application/json`, and for requests from My Phone Studio allow `Access-Control-Allow-Origin: https://my-phone-studio.vercel.app` (or a documented access policy appropriate for your app).
- This file must be emitted *as part of the application's deploy pipeline* and made public only if its metadata is non-sensitive.

Without this file or CORS permission, browser security prevents reliable remote-version detection. The Studio reports **Unverified / Fallback** and refreshes its embedded Web view every 60 seconds while open. This fallback detects no build status; it merely reloads a stable site URL.

A successful metadata response verifies a **published version identifier**, NOT GitHub Actions tests, build logs, API health, or Android APK state. The interface intentionally labels CI / BUILD as **unverified** until authenticated integrations are implemented.

## Status transitions and safeguards

| Condition | Studio status | Action |
|---|---|---|
| First valid manifest | Published revision observed | Record baseline; do not double-reload |
| Same revision and builtAt | Published revision observed | Do not reload |
| Changed revision or builtAt (automatic mode) | New published revision | Reload Web iframe once |
| Changed revision or builtAt (Session Freeze) | New release pending | Keep iframe mounted; show pending revision and an explicit "Apliko versionin e ri" action |
| Multiple new revisions while frozen | Latest release pending | Replace the pending metadata with the newest observed revision, do not reload |
| Revision rolls back to the displayed reference | No pending release | Clear the previous pending update |
| User accepts the pending release | Observer-side display reference updated | Reload the iframe exactly once and clear pending |
| Missing/CORS-blocked metadata while frozen | Unverifiable/fallback | Do not auto-reload the iframe; leave manual refresh available |
| Missing/invalid manifest | Unverifiable / fallback | Refresh every 60 seconds |
| CORS/network error | Limited check / fallback | Keep last verified revision as historical; refresh every 60 seconds |
| HTTP 401/403 | Requires authorization | Never claim published; do not fallback reload |
| Project changed while request in flight | Previous request canceled/ignored | Never overwrite the new project's status |
| Android cloud selected | Native build pinned | No automatic APK rebuild/upload |

## Trust boundary

No GitHub, Vercel or Appetize secret is used by the browser. Fetch uses `credentials: omit`.
For real private-repo CI status, a future authenticated server-side adapter needs explicit authorization and scoped tokens. Never use unrestricted public server endpoints that proxy arbitrary private GitHub credentials.

## How to add metadata to an app

For Vite, write `build-info.json` into `dist/` immediately after `vite build`. For Expo Web, write into `dist/` after `expo export --platform web`. For a Next.js output, write into its public static directory *before* the build when appropriate.

The **central Studio's** `studio/scripts/emit-build-info.mjs` demonstrates the format but changes no other repositories.

## Verification

- Node unit tests: schema validation, unchanged/revised builds, missing metadata, forbidden metadata and timeout/fallback state semantics.
- TypeScript: `npm run typecheck`.
- Expo Web static build includes `dist/index.html` and `dist/build-info.json`.
- Real browser check still required for correct iframe behavior on each app domain.

## Session Freeze — important limits

- Session Freeze is an **opt-in per-active-project UI session control**; automatic refresh remains the default. Freeze is reset when the selected project is changed, edited, or removed.
- On a new published manifest, Studio tracks both the **latest observed revision** and the **observer-side displayed reference**. While frozen, it leaves the iframe mounted, shows the latest pending version, and waits for "Apliko versionin e ri".
- Choosing "Çaktivizo Session Freeze" returns to automatic mode and **accepts any pending revision**. Clicking the existing manual "Rifresko" is also an explicit acceptance of the pending revision.
- The existing "Ndalo auto" control still suspends **all monitoring**, distinct from Session Freeze which keeps observing. When metadata is missing, freeze disables the 60-second fallback reload as well.
- **Important boundary:** Studio prevents only its **own** iframe reload. It cannot pin old server bytes or prevent the embedded app from making its own requests, navigation, service-worker updates, or internal reloads. Actual reproducible A/B testing requires immutable deployment URLs or app-controlled version pinning.
- When a project is switched, late requests from the old project are aborted/ignored; the pending release state is cleared.
- A manifest revision is not proof that CI passed; the private GitHub/Vercel status remains unverified without authenticated provider integration.

## Verification additions
- Node tests cover frozen pending changes, repeated polling without reloads, explicit acceptance, several pending revisions, rollback, and network/authorization failures.
- Playwright tests on desktop and mobile Chromium cover unchanged iframe form input under a simulated new release, one explicit apply/reload, and returning to automatic mode. These tests use a mocked preview domain, not production app repositories.
