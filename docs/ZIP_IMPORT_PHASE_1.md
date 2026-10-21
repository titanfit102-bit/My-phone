# My Phone Expo Studio — ZIP Import (phase 1) / release acceptance

Date: 2026-10-21. Scope: separate feature PR, NOT approved to merge or deploy without separate authorization.

## User workflow
1. Open any owned GitHub repository and choose **Code > Download ZIP** for branch main (or supply another valid ZIP).
2. Open My Phone Expo Studio's Web sidebar and choose **↑ Ngarko ZIP**.
3. Browser reads the ZIP metadata locally and shows its filename, stripped common GitHub root, file count, indicative framework and a clear next step.
4. Nothing is uploaded, installed, extracted or executed. No cloud build/preview is triggered. Re-importing a ZIP re-runs the analysis; this report is ephemeral, not added to the Studio's project list.

## Explicit non-goals
- This is **not yet** "upload arbitrary GitHub source and see live preview"; that needs an isolated compiler/runtime and deployment authority.
- No GitHub OAuth / private repo integration; user chooses their ZIP file locally.
- No npm install, arbitrary scripts, backend deployment, iframe of untrusted user files, or real APK execution.
- No impact on existing URL-connected Web Preview, Appetize embeds, saved project registry or Session Freeze.

## Integrity and security checks
- Max archive bytes 32 MiB, max entries 5,000, max declared uncompressed sum 512 MiB.
- Parse ZIP central directory only: EOCD integrity, offsets, entry names, basic methods, encrypted flags, symlink indicators, duplicate/case-colliding entries.
- Reject path traversal, absolute paths, backslashes, NUL/control characters, multipart/ZIP64 archives and unsupported compression methods.
- Detection from filenames is **heuristic**: an "Expo" indicator is NOT proof that a project can build, a static HTML index is NOT proof its JS/assets are valid.
- No untrusted ZIP content is evaluated or previewed as same-origin HTML. Only selected archive metadata is retained temporarily in React state.

## Reproducible tests
- `cd studio && npm ci && npm run check:config && npm run typecheck && npm run export:web && npm run test:e2e` (install Playwright Chromium where necessary).
- Unit tests generate in-memory synthetic archives with GitHub main prefix, Vite/Next indicators, static HTML, traversal, encryption, duplicate/case collisions, symlinks and invalid ZIP structural data.
- Playwright checks ZIP picker, source classification, explicit lack of preview, rejection of traversal and static candidate labeling, in desktop and mobile Chromium.

## Acceptance boundary and next phase
Gate A: branch CI SUCCESS + PR CI SUCCESS, no conflicts, exact test counts and SHA recorded, no merge until approved. Gate B: after a separately approved merge, verify production SHA and CI.
Gate C (future phase 2, separate authorization): choose safe build providers/sandbox, select supported frameworks, cap CPU/memory/time/storage/network, protect secrets, compile, host on isolated origin, then show Web Preview. Android APK build/Appetize additionally requires permissions and any charges approved.
