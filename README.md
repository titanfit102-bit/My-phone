# My-phone — Live Preview Bridge

A small, independent mobile-first web demo with a Chrome side panel that previews deployed builds and automatically refreshes when a new verified build becomes available.

## Architecture

- `web/`: standalone app UI — **the reusable starting point for a real web app**.
- `extension/`: Chrome Manifest V3 side-panel viewer. No application business logic is trapped in the extension.
- `scripts/build.mjs`: static production build; generates `build-info.json` used for deployment polling.
- `tests/`: basic offline validation.

**Important:** ChatGPT's built-in, temporary demo/canvas output does not automatically sync here. Source changes must be made to this repository, using an authorized GitHub integration or another authorized bridge. The extension does not read ChatGPT conversations.

## Quick start

Requires Node.js 20+.

```bash
npm test
npm run build
npm run dev
```

Local web app: `http://localhost:4173/` (the dev server serves `web/`; deployment build metadata only exists after building).

## Deploy with Vercel

1. Import the **private** `titanfit102-bit/My-phone` GitHub repository into Vercel as a new project.
2. Choose framework preset **Other** and repository root `./`.
3. Use build command `npm run build` and output directory `dist` (also specified in `vercel.json`).
4. Deploy and note your stable HTTPS project URL, e.g. `https://your-project.vercel.app`.
5. Each update pushed to the deployed branch triggers another Vercel build. Do not use deployment-specific immutable URLs for the viewer if you expect automatic updates.

No database, secrets or OpenAI API keys are required for this first demo. Keep production protected and do not commit credentials.

## Install Chrome extension locally

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked** and point Chrome at the `extension/` directory.
4. Click the extension icon to open its side panel.
5. Paste the deployed preview HTTPS URL and click **Connect**.
6. Chrome may ask for permission to read the preview origin. Approve only domains you control.

The extension polls `/build-info.json` on that origin roughly every 15 seconds while the panel is open. If the build revision changes, it reloads the embedded site. Deployments are not instantaneous. Some external sites or protected previews refuse to be embedded; use your own deploy domain configured for embedding. The extension is not a code execution engine and cannot bypass site security policies.

## Demonstrate a ChatGPT-driven update

To move **Profili** to the right, change `web/demo-state.json`:

```json
{ "appName": "My Phone", "profilePosition": "right", "accentColor": "#4169e1" }
```

Commit that file through an **authorized GitHub tool** from ChatGPT; once Vercel completes the build, the Chrome panel detects the new `build-info.json` and reloads. For a left-aligned button set `profilePosition` to `left`.

This first milestone supports code/config changes via GitHub, not arbitrary automatic conversion of any preexisting ChatGPT-only demo. A dedicated private MCP bridge may be added later to streamline project selection and changes.

## From demo to real application

The `web/` files form a legitimate standalone web frontend. They are **not** a finished production app: authentication, APIs, database, accessibility testing, security checks, native device integrations, error reporting, and release procedures depend on the future product. Native Android/iOS apps may require a React Native/Expo rebuild or a wrapper with platform-specific work.

## Safety

No other repositories are used or modified. The preview URL is kept in Chrome local extension storage. The extension requests access only to the URL origin you select and embeds it in a sandboxed iframe. Never use an arbitrary untrusted preview URL.
