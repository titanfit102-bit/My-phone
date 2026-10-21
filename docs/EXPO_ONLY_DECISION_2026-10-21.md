# ADR — Expo Studio is the only maintained My Phone product (2026-10-21)

**Decision status: approved product direction; cleanup implementation is PROPOSED in a PR, not merged at authoring time.**

## Scope and verified baseline
- GitHub: private `titanfit102-bit/My-phone`, baseline `main` SHA `c875f207023efa385752c307274ebcc14550a560`.
- Production Vercel: `my-phone-studio.vercel.app`, deployment `dpl_5h9jeYVDAWs5kYox9GLL9tegTgsi`, `READY` on the same SHA.
- PR #9 removed `extension/` and extension-specific tests. A separate legacy standalone website was removed from Vercel; Vercel's project listing showed only `my-phone-studio` under the My Phone name.
- Nonetheless a runnable standalone web example remained in `web/` with its own root `package.json`, scripts, root `vercel.json`, tests and `Verify My Phone` workflow. It is distinct from `studio/`.

## Agreed architecture
Maintain **one** central Expo/React Native Web Studio, with **two** preview modes:
1. Web iframe for an external application's own deployed HTTPS app.
2. Android Cloud for an external application's own APK registered through Appetize (not an Expo Web test).

Each app lives in its **own repository**. The central Studio keeps app references and UI only. Current Live Sync is browser polling of public manifest; Session Freeze prevents Studio-triggered reload. Neither equals private GitHub CI verification or immutable version pinning.

## Scoped retirement proposal
Delete **only from the PR branch**, pending merge approval:
- `web/` standalone demo assets;
- obsolete root `package.json`, `vercel.json`, `scripts/build.mjs`, `scripts/dev.mjs`, `tests/smoke.test.mjs`;
- obsolete `.github/workflows/verify.yml` (the root standalone demo pipeline).

Keep `studio/`, `studio/vercel.json`, its lockfile, all Expo tests, `.github/workflows/studio-verify.yml`, `docs/`, and `templates/emit-build-info.mjs` (adapter intended for copying into **external** application repos). Keep root `.gitignore`.

The Studio workflow is the only remaining CI; monitor README/docs/template changes as well as Studio code. Add a pure Node test asserting legacy source has not crept back into this repo.

**Do not rewrite Git history, delete old remote branches, touch another app repository, or remove a Vercel project in this PR.**

## Verification and release gates
1. Confirm intended file deletions and presence of preserved Studio/manifest template.
2. Run CI on the exact feature SHA: `npm ci`, existing known-advisory gate, all Studio Node tests, TypeScript, Expo Web export, static deployment manifest, and desktop/mobile Chromium Playwright.
3. Open PR and verify exact-head PR checks and no merge conflicts.
4. Request separate explicit approval for merging to `main` and Production auto-deploy.
5. Only after approval: verify new `main` SHA, GitHub Actions run, Production Vercel `READY` alias matching the SHA and rollback deployment reference.

## Unresolved risks
- Real external web A/B deploy with CORS + iframe still untested; use **separate test repo**, not ILLYRIAN.
- Appetize real APK session untested; no sessions/costs started by this cleanup.
- Local project registry not cross-device synchronized.
- npm audit: last verified 15 High, 7 Moderate, 0 Critical; exceptions expire **2026-11-21**. Passing CI is not equivalent to vulnerability remediation.
- Historic documentation and Git branches remain for traceability; archived past states are not current truth.

Source of truth: GitHub `main` for implementation, CI/production Vercel for verified release, Drive for decisions and planned milestones.
