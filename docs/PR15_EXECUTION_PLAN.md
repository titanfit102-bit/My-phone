# PR #15 verification and hardening plan

Goal: diagnose Actions startup and verify the existing Advanced ZIP Engine without changing its architecture or merging any PR.

Baseline: `ba2a5c02afd12b5be862832022f5a5529dfdd3ea`, PR #15 targets `feat/my-phone-engine-v1-core`. All 48 downloaded files match GitHub blob hashes. No AGENTS.md in the repository tree. Local checkout is an API-reconstructed isolated snapshot, not a clone of remote history.

- [x] Inspect Actions annotation, account usage/budget and repository permissions. Confirmed 2,000/2,000 included minutes and $0 Actions budget; no financial/settings changes.
- [x] Baseline Node 63/63, TypeScript and Expo Web export pass. Existing audit exceptions remain visible (15 High, 3 Moderate, 0 Critical).
- [x] Reproduce and fix repeated CSS URI output amplification in `studio/src/quick-preview.js`, keeping existing extraction caps and imposing 8 MiB aggregate generated CSS. Regression observed RED then GREEN; counts escaped UTF-8 output too.
- [x] Verify selected ZIP entry integrity (CRC32, local/central metadata and central-directory boundary), with corrupt stored/deflated fixtures and valid data-descriptor compatibility tests.
- [x] Extend browser verification with real font/image decoding and opaque-origin/CSP/lifecycle checks. Focused desktop/mobile browser tests 4/4 PASS; complete final suite recorded in WORK -> HIGH report.
- [x] Final local unit 71/71, TypeScript, Expo export and audit gate pass; desktop/mobile Playwright 35 PASS, 1 intentional mobile skip, 0 FAIL/flaky. Independent review completed. Publish only source/docs via GitHub API with parent/history preserved.
- [ ] Verify Vercel Preview SHA and runtime; record GitHub CI blockage and remaining release gates in WORK -> HIGH report.

Constraints: My-phone only; no main merge, Production deployment, billing changes, new cloud services or project dependencies. Test-only browser tooling may run outside the repository. Never fabricate CI success. No need to retry Actions while account evidence proves the block persists.

Review focus: output budgets count repeated URLs across stylesheets; CRC is integrity rather than trust; data descriptors remain supported; CSP does not guarantee that arbitrary JS is harmless; font fixtures must decode in a real browser.

Independent review: no High/Medium defect found. One low-severity escaped-output accounting gap was reproduced with a failing regression and corrected before final verification. No dependency or application-architecture changes. Preview runtime access is blocked by Vercel Authentication and connector 403; metadata remains readable. No broadening of access attempted.
