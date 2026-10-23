# PoF2.11 — Security review and isolated Vite artifact origin contract

**Status:** architecture proposal / NOT IMPLEMENTED.  
**Scope:** `My-phone` PR #17, based on PR #16. No cloud service, upload endpoint, automatic build, Vercel configuration, credentials, merge, or deployment is authorized by this document.

## Verified baseline

- PoF2.9: synthetic Expo 57 and Vite 7 source fixtures built with the official CLI in a separate public validation repository; 11/11 actual Playwright browser assertions. [Run 39940412584](https://github.com/titanfit102-bit/my-phone-pof-validation/actions/runs/39940412584).
- PoF2.10: fresh official Expo Web export packaged as a ZIP and imported through the **actual Studio UI**. Desktop and mobile Chromium tests passed, including render, counter click, local PNG decode, opaque-origin frame parent/storage denial, and close/disposal. [Run 39946926578](https://github.com/titanfit102-bit/My-phone/actions/runs/39946926578).
- PR #17 offers only a bounded **offline single-bundle Expo Metro** profile and retains the historical one-bundle Vite path. It explicitly **refuses Vite multi-chunk imports**. The HTTP multi-chunk service has not been deployed or integrated.
- Studio's frame for offline ZIPs must remain `sandbox="allow-scripts"` **without** `allow-same-origin`. Existing deployed URL/Appetize preview is a separate feature with a separate trust model and must not be silently reused for untrusted ZIPs.
- CI success is **not** proof of containment against arbitrary hostile code, CPU/memory exhaustion, dependency behavior, or private uploads.

## Target architecture — multi-chunk Vite profile (future separate PR)

**Key invariant:** untrusted build files must never be served from the Studio application origin, or from another application's artifact origin.

1. **Intake / validation (read-only):** browser classifies the ZIP, rejects source-only builds, dotfiles/secrets, symlinks, dangerous paths, duplicate/case-colliding names, unsupported external URLs, unsupported ZIP methods, and size/resource budgets. Validation reads the complete artifact manifest and hashes every selected file. Never trust file extension as MIME or render arbitrary HTML as Studio content.
2. **Authority boundary:** the user's explicit selection/authorization of an artifact grants permission only to preview a bounded, prebuilt **static Web output**. It does *not* authorize npm install, build scripts, backend execution, persistent storage, external network, changing GitHub, or production deployments.
3. **Artifact host:** assign a *new, random, unguessable, per-session origin* (e.g. `https://<session>.isolated-preview.example`; illustrative only, NOT an existing domain). Never reuse origin across unrelated users/projects; avoid parent Studio cookies, API tokens, shared auth/session state, and service-worker state. Serve only allowlisted **immutable** artifact files with verified content hashes and explicit MIME. No directory listing, traversal or cross-session access; bound storage/expiry/byte/request quotas. If no independent origin is available, mark status `BUILD_READY_PREVIEW_UNAVAILABLE` instead of falling back to insecure `srcDoc` rewriting.
4. **Iframe:** host sets `sandbox="allow-scripts"` and `referrerPolicy="no-referrer"`; no `allow-same-origin`, popups, top-navigation, forms, downloads, or privileged bridges by default. The host's **header-level** `frame-src` allows only the specifically selected artifact origin; the artifact's **header-level** `frame-ancestors` permits only the trusted Studio origin. CSP in an HTML meta tag cannot implement `frame-ancestors` or HTTP `sandbox`.
5. **Response security:** preview documents use header CSP: `default-src 'none'`; `script-src <exact artifact origin>`; `style-src <exact origin> 'unsafe-inline'` only if the approved build needs inline style; `img-src <exact origin> data:`; `font-src <exact origin> data:`; `connect-src 'none'` for the offline tier; `object-src 'none'`; `base-uri 'none'`; `form-action 'none'`; `worker-src 'none'`. Test the exact CSP rather than assuming `'self'` works in an opaque-origin sandbox.
6. **CORS:** with `sandbox="allow-scripts"` and no `allow-same-origin`, the document has origin `null`; ESM relative imports/chunks and fonts fetched from its physical artifact server may require appropriate **noncredentialed** CORS (normally `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Credentials` absent, `Cross-Origin-Resource-Policy: cross-origin`). Deny cookies, credentials and any resource access outside that artifact session. Verify nested ESM, `import.meta`, dynamic imports, CSS, fonts, refresh/deep links.
7. **Protocol/state:** allowlisted preview-session ID and stable artifact revision; on close, revoke access and expire artifacts. No `postMessage` trust merely because `event.origin === "null"`; defer any host-communication bridge and use explicit capabilities/schema validation with no privileged generic actions.
8. **Compliance:** keep licenses/THIRD_PARTY_NOTICES, verify provenance, distinguish user-owned public/synthetic fixtures from private applications, and disclose retention explicitly. Do not claim arbitrary Android/Expo Router/backend support.

## Threat model / release gates

| Risk | Severity | Required evidence before enabling |
|---|---|---|
| Same-origin execution or `allow-scripts allow-same-origin` on Studio-hosted code | P0 | Explicit separate origin + sandbox audit and adversarial parent DOM/storage tests |
| Preview cross-session file access / cookie/token exposure | P0 | Session isolation, storage tests, noncredentialed CORS, authorization and expiry tests |
| Untrusted source/install/build execution | P0 | Denied by default; explicit later isolated build provider with VM/process-level boundary |
| External network/exfiltration, redirects, `postMessage` privilege escalation | P0 | CSP/header validation, denied egress tests and no privileged bridge |
| ZIP bombs, PNG parser confusion, CPU/memory exhaustion | P1 / potential P0 at scale | Resource caps, fail-closed corpus, timeouts and malformed-input tests |
| Relative ESM chunks, CSS/fonts, routes, base paths | P1 | Official Vite build + Playwright including dynamic chunk 200, reload, nested routes |
| Artifact manifest, SHA-256, provenance, third-party notices | P1 | Reproducible output, verified digest/inventory and notice checks |
| Usability of unsupported profiles | P1 | Clear diagnostics; never present a broken/unsafe preview as success |

## Explicit NO-GO / transition sequence

- **Today:** keep Vite multi-chunk `BLOCKED_REQUIRES_ISOLATED_ORIGIN`, without uploading anything.
- **Next validation:** independent architecture/security review of origin, headers, CORS, session authorization, caching and cost/quota caps; synthetic fixtures only.
- **Next implementation (requires separate authorization):** artifact-host proof in a disposable, isolated environment with no Studio credentials; verify official Vite multi-chunk with Playwright against real service headers.
- **Later (requires separate authorization):** integrate host/loader into Studio in its own draft PR; run adversarial regression, capacity limits, GitHub CI, origin-separation test, and finally user-approved merge/deployment.

**No GO claim for Vite multi-chunk Studio integration yet.** Passing PoF2.9/2.10 remains evidence of narrower capabilities only.
