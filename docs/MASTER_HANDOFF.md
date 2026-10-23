# MASTER_HANDOFF — My Phone Expo Studio
**Vazhdimësi e qëndrueshme; checkpoint fillestar: 2026-10-23 (Europe/Rome).**

> **BOOTSTRAP për çdo ChatGPT tjetër — lexo fillimisht:**
> 1. Repository kryesor: https://github.com/titanfit102-bit/My-phone
> 2. **Dega e handoff-it: docs/continuity-checkpoints (NUK është main).**
> 3. Lexo [docs/CURRENT_STATE.md](./CURRENT_STATE.md) dhe këtë dokument nga ajo degë, jo nga main.
> 4. Verifiko live refs main, PR #12–21 (sidomos #19/#20/#21), GitHub Actions dhe degët e provave te repo e validimit dhe, kur duhet, statusin e Vercel. Nëse gjendja ka lëvizur, bëj reconciliim me checkpoint-in.
> 5. Rregull autorizimi: përditësimi i vazhdueshëm lejohet **vetëm për këta dy skedarë** në degën docs/continuity-checkpoints. Kodi, PR të tjerë, main, merge, deploy, cloud, pagesa dhe repos të tjera kërkojnë miratim specifik.
> 6. Vazhdo detyrën e fundit të papërfunduar; mos e nis nga zero dhe mos e ngatërro PoF me Production.
>
> Prompt i shkurtër rikuperimi: “Vazhdo My Phone Expo Studio. Lexo GitHub titanfit102-bit/My-phone **branch docs/continuity-checkpoints**, dokumentet docs/CURRENT_STATE.md dhe docs/MASTER_HANDOFF.md; verifiko live commits, PR, CI; vazhdo nga NEXT ACTION brenda autorizimeve, pa ndryshim kodi/merge/deploy pa leje.”

## CURRENT NEXT ACTION — 2026-10-23 (AUTHORITATIVE; overrides historical roadmaps)

**Do not resume at PoF2.13 or repeat A01/A02.** PoF2.13–2.16 are previous proofs/design; PoF2.17 remains proposed. A02 is CI verified in two independent Draft branches, PR #19 (main-based) and PR #20 (stacked onto PR #17), with distinct abort semantics. A01 is implemented and verified by deferred browser ZIP race E2E in Draft PR #21 (stacked onto #20), SHA `4e87eed2`, CI 40018511996 SUCCESS (106 Node, 43 Playwright PASS, 3 SKIP). No PR merged. **Next:** reconcile A02 variants read-only; then A06/A07 registry and backup integrity require separate explicit code authorization. Official Expo ZIP import on PR21 exact SHA and release gates are NOT RUN; private remote Vite remains NO-GO.

Latest verified app main bf1b65e72760dca5c8dd2fb92e9c79b65f77c6df; PR17 head efa551885a9edf8e85e596da1e25c9994a71b284; PoF2.16 head 4c5232c1ca2e0cb82e06916ccdd10c3756293059. Continuity branch docs/continuity-checkpoints, Draft PR18. Always recheck live refs.

### Audit stabilization — implementation checkpoint (2026-10-23)

**[IMPLEMENTED ONLY IN DRAFT BRANCHES]** A02 has two overlapping, independently tested implementations: PR19 `fix/a02-bounded-live-sync-reader` SHA `01e6527e917486c1eea83bf97250241d205b9ca3`, base main, CI 40014826947 SUCCESS; and PR20 `feat/p1-live-sync-bounded-manifest-reader` SHA `8d5d526a45c0840b7f3af95e17721bb91d5eebb7`, base PR17, CI 40017617907 SUCCESS with 106 Node PASS, 41 Playwright PASS and 3 SKIP. They fix the same P1 byte-bound manifest issue by different approaches; PR20 adds 8 Node tests and 1 Playwright case (desktop/mobile). **Do not merge both blindly.** No PR19 edits were performed in this continuation.

**[CI AND DEFERRED ZIP RACE E2E VERIFIED IN BRANCH; OFFICIAL EXPO ARTIFACT RECHECK STILL PENDING]** A01 Draft PR21 `feat/p1-zip-import-lifecycle-invalidation` SHA `4e87eed2f860a846c643301a55186333318c5689`, stacked onto PR20, addresses stale parent/child ZIP callback and busy cancellation. CI run 40018511996 **COMPLETED SUCCESS**, 106/106 Node, 43 Playwright PASS, 3 SKIP (desktop and mobile new deferred ZIP E2E both PASS). Its parent-side synchronous epoch and child unmount/cancel ticket prevent stale completion from mounting a preview after a project/mode switch. Newly added deferred File.arrayBuffer browser test passed desktop and mobile; this verifies stale async file-read rejection/cancel only and is not a CPU-preemption proof. It does not interrupt synchronous CPU-bound parse. No merge, Production deployment or new official Expo ZIP CLI test was run for this SHA.

**[RELEASE/ROADMAP]** Reconcile duplicate A02 PRs and validate A01 exact SHA; then A06/A07 integrity, A04/A08 evidence, A03/A09 negative and accessibility tests. Private remote Vite stays NO-GO; PoF2.17 remains proposed. Maintain separate SOURCE/TESTED/RELEASED statuses. This checkpoint does not create a new authorization to merge or modify unrelated branches.

### Source audit checkpoint 2026-10-23 — PR19/20 decision and A06/A07

Read-only comparison at exact branch heads confirms that PR19 (`readBoundedManifestBody`) aborts its fetch on oversized/malformed declared Content-Length, whereas PR20 (`readBoundedManifestText`) returns `null` on declared oversize without explicitly aborting network/body. PR20 cancels acquired readers for oversized streamed chunks and has a new Playwright oversized-manifest case. PR19 rejects malformed headers immediately; PR20 bounds the actual stream when the header is malformed. Preferred integration **proposal**: retain contiguous Draft PR17 → PR20 → PR21 stack, with explicit abort/cancel early-return regression before integration; do not merge PR19 as a duplicate. No code change or merge authorized by this recommendation.

**A06 [SOURCE CONFIRMED / BROWSER NOT RUN]:** App.tsx `save` appends project 101 without a count guard, then `setProjects`, while `validateProjectList` in project-storage.js rejects >100 at persistence and backup. Expected patch: reject additions before state mutation; edits at count 100 continue.

**A07 [SOURCE CONFIRMED / ROUND-TRIP TEST NOT RUN]:** `cleanWebUrl` lacks URL length bound; serialized registry and export have no shared UTF-8 byte ceiling; `parseProjectBackup` checks JS string length while upload checks File.size bytes, so generated backups may not reimport. Expected patch: shared UTF-8 budget and validated export → import round-trip invariant; add Unicode, oversized URL, merge and boundary tests.

**Authorization:** Only `docs/CURRENT_STATE.md` and `docs/MASTER_HANDOFF.md` on `docs/continuity-checkpoints` may be automatically updated. A02/A06/A07 code, CI test additions, branch/PR actions, merges, production changes require separately scoped permission. Official Expo ZIP UI proof at latest PR21 SHA NOT RUN. main at `bf1b65e72760dca5c8dd2fb92e9c79b65f77c6df` unchanged as of verification.
## 1. Identiteti, vizioni dhe kufijtë e produktit

**[DECIDED]** Produkti quhet **My Phone Expo Studio**: një hapësirë qendrore me telefon virtual që lejon përdoruesin të menaxhojë referenca projektesh, të hapë Web previews ose Android cloud previews, dhe për profile të mbështetura të importojë ZIP prebuilt për shikim të përkohshëm. Ambicia finale është një rrjedhë e besueshme ZIP/GitHub → preview sa më automatik, në browser/telefon, pa instalime të detyrueshme në PC dhe pa shpenzime të papritura. Ambicia nuk është e njëjtë me mbështetje universale aktuale.

**[DECIDED]** Vetëm një Studio qendrore mirëmbahet në repository My-phone, kodi në studio/ (Expo SDK 57 / React Native / React Native Web). Chrome Extension legacy dhe demoja standalone janë tërhequr historikisht sipas ADR, jo objektiva të reja pune. Aplikacionet e tjera mbeten në repos, deployment-e, databaza, backend-e dhe konfigurime të vetat. Mos e ngatërro Studio-n me kodin e aplikacioneve që shfaq; mos transfero kod privat përdoruesi në këtë repository ose në prova publike.

**[PRODUCT PREFERENCES]** Cilësi production-grade me evidencë reale; përmbajtje e saktë e statuseve PASS/FAIL/NOT RUN; pak ndërhyrje manuale; kosto shtesë = jo pa miratim; teste sintetike të ndara nga të dhënat reale; siguri e fortë e iframe/origin/egress; raporte progresi me çfarë u bë, çfarë mbetet, hapi pasues dhe statusi i handoff-it. Përqindje të progresit vetëm nëse ka denominator dhe faza të verifikueshme; mos shpik numra.

## 2. Burimet e së vërtetës dhe statuset

1. **Zbatimi i publikuar:** main i My-phone + GitHub Actions në SHA përkatëse + Vercel deployment/alias nëse verifikohet live. Dokumentacioni historik nuk e bën një PR Production.
2. **Zbatimi i papublikuar:** branch/commit konkret dhe PR #12–17; këto ekzistojnë veç nga main.
3. **Provat eksperimentale:** repo publik i dedikuar titanfit102-bit/my-phone-pof-validation; PoF2.9 dhe PoF2.12 janë sintetike, jo shërbime reale për përdorues.
4. **Konteksti i vazhdimësisë:** këta dy dokumente në degën e qëndrueshme docs/continuity-checkpoints; checkpoint mund të jetë i vjetër dhe duhet reconciliuar.
5. **Vendime të specializuara:** dokumentet ekzistuese docs/* të branch/PR përkatëse. Mos i zëvendëso ose rishkruaj pa audit dhe autorizim.

Etiketa të detyrueshme: **[VERIFIED]** provë e jashtme/CI; **[DECIDED]** vendim i përdoruesit; **[IMPLEMENTED-IN-BRANCH]** kod i shkruar, jo Production; **[PROTOTYPE]** provë sintetike; **[PROPOSED]** arkitekturë/plan; **[BLOCKED]** punë e ndaluar pa kusht/autor.; **[UNKNOWN]** pa provë. Green CI ≠ mungesë vulnerabilities ≠ aplikacion funksional për çdo ZIP.

## 3. Arkitektura ekzistuese e Studios

**[VERIFIED FROM CODE/DOCS]** Aplikacioni kryesor në studio/ me Expo/React Native Web, React 19.2.3, RN 0.86, RNW ~0.21, Node >=22.13. Expo Web static output studio/dist; historikisht Vercel my-phone-studio.vercel.app. Setup/CI: npm ci; npm run check:config; npm run typecheck; npm run export:web; npm run test:e2e (Playwright desktop/mobile). README dhe studio/README.md për detajet e përdorimit.

- **Project registry:** rekord {id,name,github,web,native}, ruajtur lokalisht në browser (my-phone-studio-projects-v1). Import/export JSON; jo sinkronizim multi-device dhe jo host për source. GitHub URL është referencë, jo autorizim për build.
- **Published Web URL preview:** iframe nga një deployment i aplikacionit tjetër, me refresh të bazuar në /build-info.json çdo ~15 sekonda; kur metadata mungon, fallback refresh rreth 60 s nëse nuk është ngrirë. Session Freeze kontrollon reload-in e bërë nga Studio, jo kodin e aplikacionit nga hosti.
- **Android Cloud preview:** embed URL e një APK-je ekzistuese në Appetize; nuk prodhon, nënshkruan, ngarkon apo nis automatikisht APK. Sesione cloud mund të jenë me pagesë dhe kërkojnë miratim.
- **ZIP inspector:** kontroll strukturor për metadata/paths/symlinks, limit 32 MB ZIP, 5000 hyrje, maksimum 512 MB të deklaruara për çkompresim. Framework detection është indikator; buildCandidate ≠ preview i suksesshëm.
- **Quick Preview i PR-ve:** ZIP Web prebuilt me bundle të vetëm, disa CSS, imazhe/font lokale të kufizuara, sandbox srcDoc me origin opak, no same-origin, no egress. Nuk ruhet si My Projects dhe nuk ekzekuton raw source.
- **Engine Core:** funksion determinist assessZipInspection, me statuse candidate/prepared/failed/build_required/native_build_required/unsupported, dhe diagnostics të strukturuara. “prepared” nënkupton HTML për iframe të krijuar, jo provë renderimi.
- **Expo Web adapter në PR #17:** vetëm Metro single-bundle + PNG të verifikuara, profil offline i kufizuar; rruga aktuale e Studio-s **refuzon** Vite multi-chunk në vend që të simulojë sukses.
- **Vite multi-chunk PoF2.12:** origin fizik i veçantë që shërben skedarë immutable Vite dist, CSP/CORS dhe iframe allow-scripts; në prototip loopback me 127.0.0.1/.2/.3. Nuk ekziston shërbim i autorizuar me HTTPS, auth, tenant isolation dhe upload për këtë në Studio.

**[SECURITY BOUNDARY]** iframe i ZIP-it offline është sandbox="allow-scripts" **pa** allow-same-origin. Web URL/Appetize frame në Studio mund të ketë kontratë tjetër; nuk duhet ripërdorur pa audit si host për kod ZIP të panjohur. Default: kodi source-i nuk niset në origin-in e Studio-s.

## 4. Historia e vendimeve dhe progresit, rend kronologjik

- **[DECIDED] 2026-10-21, Expo-only ADR:** mbaj vetëm produktin Expo Studio; aplikacionet e tjera në repos të tyre; legacy extension/web proof tërhiqen me PR të shqyrtuara. Dokument: docs/EXPO_ONLY_DECISION_2026-10-21.md (kujdes: disa gjendje aty janë historike).
- **[IMPLEMENTED-IN-BRANCH] PR #12:** prebuilt Web ZIP Quick Preview përkohshëm, jo source compilation; sandbox origjinë opake.
- **[IMPLEMENTED-IN-BRANCH] PR #13:** telefon virtual premium/layout me shumë kolona.
- **[IMPLEMENTED-IN-BRANCH] PR #14:** Engine Core dhe diagnoza deterministe.
- **[IMPLEMENTED-IN-BRANCH] PR #15:** CSS të shumta, imazhe/font lokale me buxhete dhe verifikime.
- **[IMPLEMENTED-IN-BRANCH] PR #16:** njoftime/licenca/CI për repo publik, security audit gating dhe evidence. Statusi open non-draft, jo merged.
- **[HISTORICAL PROTOTYPE] PoF1–2.8:** prova offline/mock të kontrolluesit, fixtures, Chromium sandbox; build-et zyrtare fillimisht të bllokuara nga npm registry EAI_AGAIN. PoF2.5/2.7/2.8 forcuan PNG, testuesin, dynamic chunks/CSP; mock PASS **nuk ishte** provë e build-it real.
- **[VERIFIED] PoF2.9 2026-10-23:** repo publik i ndarë i validimit, official Vite build + Expo export, 11/11 testet browser PASS. Run https://github.com/titanfit102-bit/my-phone-pof-validation/actions/runs/39940412584 ; SHA repo validimi 93fef989cd9f752b135fb466a09b24c97f1dd10e. Pas disa dështimeve të test-harness CSP, u korrigj frame-src; historia e dështimeve nuk fshihet.
- **[IMPLEMENTED-IN-BRANCH] PR #17:** Expo Metro single-bundle offline ZIP adapter dhe refuzim fail-closed për Vite multi-chunk, teste Node/E2E/official artifact; PNG CRC/zlib/scanlines, diagnostikë framework; arkitekturë dokumenti për origin Vite.
- **[VERIFIED] PoF2.10:** e përpiloi fixture-in Expo me CLI dhe e futi ZIP-in e plotë (4 file) në UI reale të Studio-s në Chromium desktop/mobile, kontroll render/kundër/lokal PNG/origin. Run https://github.com/titanfit102-bit/My-phone/actions/runs/39948253179 ; 2/2 PASS në SHA të PR #17.
- **[PROTOTYPE VERIFIED] PoF2.12:** Vite official build + dy hoste loopback të ndryshme + Studio-like host i tretë, lazy chunk HTTP 200, CSP/frame-ancestors, noncredentialed CORS, parent/storage blocked, cross-session fetch/image blocked, popup blocked, reload, revocation, mutation SHA. 21/21 PASS, run https://github.com/titanfit102-bit/my-phone-pof-validation/actions/runs/39968191033 , branch feat/pof212-vite-isolated-origin SHA a1ac3801578172b6667caf781702bd79e79a1ea7 . **Nuk** ka backend publik, autentikim sesioni, tenant isolation TLS, ose integrim në Studio.
- **[DECIDED] 2026-10-23 continuity protocol:** checkpoint i përhershëm me docs/CURRENT_STATE.md dhe docs/MASTER_HANDOFF.md në degë të veçantë; autorizim i vazhdueshëm për modifikim vetëm të këtyre dy dokumenteve, pas ndryshimeve të verifikuara; pa prekur kod, main, PR të tjera, deploy/shpenzime.

## 5. GitHub state: commits, PR stacking dhe prova

Repository: https://github.com/titanfit102-bit/My-phone ; main i fundit i verifikuar: bf1b65e72760dca5c8dd2fb92e9c79b65f77c6df. Dukshmëria e verifikuar ishte **PUBLIC**; README dhe ADR e vjetër thonë private, nuk duhet t'u besohet verbërisht.

| PR | Target/Base (branch) | Head i verifikuar | Status |
|---|---|---|---|
| [#12](https://github.com/titanfit102-bit/My-phone/pull/12) | main | 5ae28c608de6d85743939b6231c2d93983973798 | open, non-draft |
| [#13](https://github.com/titanfit102-bit/My-phone/pull/13) | feat/ephemeral-zip-web-quick-preview | e6ea8a3f4a4d3d2dade4e7b518fcdcd856aa9983 | open Draft |
| [#14](https://github.com/titanfit102-bit/My-phone/pull/14) | feat/premium-fixed-phone-workspace | 2b9ddd14484a056f370560e134491ba24006c595 | open Draft |
| [#15](https://github.com/titanfit102-bit/My-phone/pull/15) | feat/my-phone-engine-v1-core | 53cf53d79854876536377aa520650aef4621bd43 | open Draft |
| [#16](https://github.com/titanfit102-bit/My-phone/pull/16) | feat/advanced-zip-local-assets | c100925e8635277743da9d6a1575a1798b2a6afa | open, non-draft |
| [#17](https://github.com/titanfit102-bit/My-phone/pull/17) | feat/public-ci-notices-hardening | efa551885a9edf8e85e596da1e25c9994a71b284 | open Draft |

Zinxhiri i varësisë: main → #12 → #13 → #14 → #15 → #16 → #17. Mos bashko jashtë radhe dhe mos supozo se PR17 ka hyrë në main.

Testet [Run 39948253159](https://github.com/titanfit102-bit/My-phone/actions/runs/39948253159) në PR17 SHA efa55188: **98/98 Node PASS**, **39 Playwright PASS / 3 skipped**, typecheck + export PASS. [Run 39948253179](https://github.com/titanfit102-bit/My-phone/actions/runs/39948253179): 2/2 real Expo Web official ZIP import desktop/mobile PASS. PoF2.9 dhe 2.12 janë në repo të veçantë dhe të ndara nga Production. CI artifacts mund të skadojnë; run URL/commit/manifest mbeten referencat kryesore.

## 6. Dokumentacioni ekzistues — mos e dyfisho

| Dokumenti | Qëllimi |
|---|---|
| docs/STUDIO_ARCHITECTURE.md | produkti, mode Web/Android, release gates |
| docs/EXPO_ONLY_DECISION_2026-10-21.md | ADR produkti i vetëm Studio dhe largimi i legacy |
| docs/LIVE_SYNC_V04.md | polling build-info, Session Freeze, fallback |
| docs/CONNECT_A_NEW_APP.md | onboarding i aplikacioneve të jashtme |
| docs/IFRAME_STORAGE_HARDENING.md | iframe/storage kufijtë |
| docs/ZIP_IMPORT_PHASE_1.md | analizë ZIP read-only |
| docs/QUICK_PREVIEW_ZIP.md | prebuilt single-bundle Quick Preview (në stacked branch) |
| docs/ADVANCED_ZIP_LOCAL_ASSETS.md | CSS/font/image, limits (në stacked branch) |
| docs/MY_PHONE_ENGINE_V1_ARCHITECTURE.md | API deterministe, faza 1–5, ADR (stacked branch) |
| docs/PUBLIC_CI_LICENSES_AND_WORKFLOWS.md | licenca/CI (stacked branch) |
| docs/POF211_ISOLATED_VITE_ARTIFACT_ORIGIN_ARCHITECTURE.md | threat model dhe arkitekturë e propozuar Vite |
| docs/SECURITY_ADVISORY_TRIAGE_2026-10-21.md | npm audit exceptions dhe rreziqe të hapura |

Dokumentet e PR-ve #12–17 nuk janë domosdoshmërisht në main. Hap file-in me branch/SHA të saktë. Dokumentimi publik që thotë “repository privat” është i vjetruar sipas API GitHub 2026-10-23; korrigjim në README kërkon autorizim veçmas.

## 7. Probleme të hapura dhe risqe të prioritizuara

**P0 — Gate për shërbimin e ardhshëm të Vite**
- Nuk ekziston izolim production me HTTPS dhe origjinë fizike/site të veçantë për përdorues/sesion; PoF2.12 ka vetëm loopback.
- Nuk ekziston authZ për create/get/render/revoke/delete të preview session; linku i vështirë për t'u gjetur nuk është autentikim. Rreziku cross-tenant dhe leak i artefakteve është real.
- Nuk ka sistem të verifikuar retention/TTL/erasure, abuse quotas, revoke of individual assets, akses audit, CSRF/session-binding, autentikim dhe entitlement. Mos publiko endpoint me kode përdoruesish.
- Host/Egress: iframe opak, CSP, CORS dhe asset host s'duhet të ekspozojnë Studio cookies/provider tokens ose të lejojnë cross-project fetch. postMessage nga origin null nuk është provë identiteti.
- Nuk autorizohet npm install/run scripts nga ZIP i panjohur, build i pakufizuar ose përdorim sekretash.

**P1 — Siguria / korreksia**
- npm audit, baseline i njohur High i patrajtuar: nga CI më i fundit i PR17 **15 High / 3 Moderate / 0 Critical**; të dhënat e triage të 2026-10-21 kishin 15 High / 7 Moderate. Këto janë momente të ndryshme, jo rregullime të verifikuara. Përjashtimet e përkohshme GHSA-vfj7-8cjw-p6xm dhe GHSA-86w9-cpqp-85rv kërkojnë rishikim para 2026-11-21. Mos përdor npm audit --force pa audit kompatibiliteti.
- ZIP malicious paths, symlinks, escape, decompression bombs, PNG parser edge cases, CPU/heap/resource abuse; testet aktuale nuk mbulojnë të gjithë input-et armiqësore.
- PR dependencies/merge sequencing, manual release/rollback, Vercel SHA and APK/Appetize acceptance ende jo të konfirmuara për këto PR.

**P2 — Produkti / përdorimi**
- Diagnostika e plotë për formatet e pambështetura, përvojë mobile, support i asset-eve të tjera, status i saktë “preview prepared” vs “rendered” vs “run tested”.
- Workflow i sigurt dhe i ligjshëm për owner-owned GitHub source → isolated build në të ardhmen; costs, permissions, licenca/provenance, re-run, EAS Android.

**[UNKNOWN]** A ekzistojnë kërkesa përdoruesi në biseda të tjera që nuk janë të disponueshme këtu; gjendja aktuale e Vercel deploy në momentin e këtij checkpoint-i; vlera e plotë e live traffic; vlerësim i matur i përfundimit total; rezultate me projekte private reale. Mos shpik.

## 8. Roadmap drejt produktit të plotë (plan, jo implementim)

| Faza | Objektivi | Gate i objektivizuar |
|---|---|---|
| A. Stabilizim / integrim i PR #12–17 | Audit, fix risk, review stacking, app QA, explicit approval per merge | CI exact-SHA, security triage, license, UX regression, user-approved release |
| B. PoF2.13: Session authorization design | lifecycle i plotë, authZ, tenant/origin separation, TTL/revoke/rate limits, threat model, test cases | review i dokumentuar, pa pasiguri P0, pa kod cloud në këtë fazë |
| C. Prova e ardhshme e izoluar HTTPS/tenant | fixtures sintetike, per-session host, auth enforcement, ESM chunks, revoked access, no credential egress | test i pavarur negative/positive; zero shared origins/token leakage; budget guard |
| D. Vite multi-chunk Studio integration | adapter/repository preview service i veçantë, upload prebuilt static vetëm me autorizim | Draft PR i veçantë, integration Playwright, adversarial tests, no Production merge pa leje |
| E. Source ZIP / GitHub read-only automation | zbulim, diagnozë, provider status i autorizuar, optional build runner i izoluar | credential isolation, provenance, worker quotas, consent, costs, fail-closed |
| F. Android/APK dhe release | flow i qartë për APK build të jashtëm/Appetize, private access, cost limits; verification manual | owner APK tested, budgets, acceptance, rollback, privacy |
| G. Product hardening / launch | reliability, onboarding, error diagnostics, a11y/mobile, observability, security retest, release | full DoD me kritere të matshme, Vercel SHA/deploy verified dhe user release approval |

Nuk ka përqindje universale të verifikuar: fazat, weight dhe kosto-t ende nuk janë formalizuar për përllogaritje. Prototipet PoF janë gates të kaluara për pjesë të veçanta, jo të gjitha fazat.

## 9. HISTORICAL DESIGN RECORD: PoF2.13 (SUPERSEDED; NOT THE CURRENT NEXT ACTION)

**Status më 2026-10-23: [DESIGN ANALYSIS COMPLETED; IMPLEMENTATION NOT STARTED].** U lexua pof212/isolated_host.mjs dhe browser_proof.mjs (branch eksperimental); draft i modelit dhe test-plan i authZ u formulua më poshtë. Nuk është krijuar asnjë shërbim i ri, nuk është shtuar kod dhe nuk ka prova reale të autentikimit të skedarëve.

Kërkesa për PoF2.13 design:
1. Përcakto aktorët (owner, viewer, host, artifact service, attacker), nivelin e besimit dhe ndarjen e privileges.
2. Modelin e sesionit: sessionId, tenantId, artifact digest, revision, createdAt/expiresAt/revokedAt, authZ scope, origin allowlist, access/egress audit dhe deletion.
3. Rrugën create → validate immutable artifact → authorize view → serve chunks → renew → revoke/expire → delete, me fail-closed në çdo hap.
4. Metodën e kontrollit të aksesit edhe për **çdo** .js/.css/.png/.woff2 dhe jo vetëm /index.html; refuzo cross-session manifest/chunk enumeration dhe cache-bypass.
5. Zgjidhjen e konfliktit teknik ESM opaque-origin: CORS noncredentialed për chunks + autentikim real pa vendosur Bearer token në import URL. Shqyrto alternativa (cookie partitioning + cross-origin access, signed URLs, capability hostnames, server-side proxy) dhe sulmet e tyre; mos supozo zgjidhje magjike.
6. Threat matrix për URL leakage, CSRF, replay, session fixation, cache leaks, DNS rebinding, CSP frame-ancestors, sandbox escape, malicious script CPU/DoS, cost and retention.
7. Krijo acceptance matrix PASS/FAIL/NOT RUN, provë e propozuar pa kosto të paautorizuara; vendim GO/NO-GO për prototipin e ardhshëm.
8. Nëse ka vendim të rëndësishëm të verifikuar/autor. dokumentoje te dy skedarët continuity; nëse vetëm propozim, regjistro statusin [PROPOSED] dhe shëno çfarë kërkon leje.

**PoF2.13 design findings (2026-10-23; [PROPOSED] unless otherwise marked):**

**Evidence & core security bug gap.** [VERIFIED FROM CODE] PoF2.12 pof212/isolated_host.mjs kufizon GET/HEAD, file allowlist, SHA-256, TTL 10 min, request budget 200, deny unsafe paths, origin loopback, CSP/CORS dhe revoke. Megjithatë çdo kërkesë brenda sesionit aktiv për një file në manifest kthen skedarin **pa kontroll të owner/viewer identity / authorization**. GET direkt nga një klient tjetër nuk bllokohet nga frame-ancestors; CSP e iframe-it ndalon disa dalje nga kodi, por nuk është mbrojtje e aksesit HTTP. Testi PoF2.12 provoi izolim të kufizuar, jo siguri të dhënash private. Mos e ngrit këtë host direkt në internet.

**Aktorë dhe trust boundaries:**
- Owner (përdorues i autentikuar) vendos cilin artifact të vet do të publikojë për preview dhe për kë; viewer mund të ketë leje të kufizuar; attacker mund të marrë URL, të dërgojë cross-origin requests, të enumerë skedarët ose të modifikojë build-in.
- Control plane (trusted API i ndarë nga browser), me identity/session, autorizon create/renew/revoke/status dhe lidh tenantId ↔ artifact digest ↔ viewer grants.
- Artifact service/data plane (origin i veçantë HTTPS, jo Studio origin) shërben vetëm content immutable i manifestit, me autorizim për **çdo** index/script/chunk/CSS/font/image/route. Kodit të preview-it nuk i jepen credentials të Studio-s, API keys ose privileged postMessage.
- Public GitHub fixture/test runner është territor tjetër besimi nga prodhimi dhe nga repository të përdoruesve; mos kopjo private source aty.

**Model reference, vetëm propozim (schema, jo API e implementuar):**
- Session: random server-generated sessionId, tenantId, ownerSubject, allowedViewerSubjects, artifactSha256, immutableManifestSha256, revision, uniqueIsolatedOrigin, state, createdAt, expiresAt, revokedAt, deletionDueAt, requestQuota, byteQuota, auditCorrelationId, policyVersion.
- Grant: owner/viewer/role, resource-set (only known artifact revision), action (create/view/revoke), notBefore/expiresAt, revocation epoch; least privilege.
- Server-side mandatory checks per request: session ACTIVE, tenant/role authorization, not expired/revoked, path from immutable manifest, unchanged digest/MIME, no credential leaks, no cross-session access, quotas, redacted log; failures 401/403/404/410 as appropriate with no path enumeration leak.
- States: NEW → VALIDATED → AUTHORIZED → ACTIVE → REVOKING → REVOKED or EXPIRED → DELETING → DELETED. Only allowed transitions with atomic revocation; no reuse of origin/session token after deletion. Revoke must stop **future** HTTP reads and close iframe in Studio; it cannot retroactively erase bytes/code already downloaded into a browser session.

**Teknika e vështirë e ESM dhe e autentikimit:**
- Preview-i i sigurt mban sandbox=allow-scripts **pa** allow-same-origin. Dokumenti ka origin opak/null. Dynamic module requests dhe fontet përdorin rrugë fizike HTTP dhe CORS; [REFERENCE] MDN shpjegon se kërkesat cross-origin pa konfigurim specifik të credentials nuk dërgojnë cookies. Prandaj cookie i kontroll-plane nuk mund të supozohet se autentikon automatikisht importet ESM.
- CORS ACAO:* pa credential është i përshtatshëm vetëm kur serveri ka zgjidhur në mënyrë të pavarur autorizimin. Nuk është autentikim. Mos pasqyro Origin:null si principal të besuar.
- **Option A**: cookies partitioned/credentialed për artifact host; test browser cross-origin ESM me origin opak; nuk është provuar dhe nuk duhet supozuar. Mos shto allow-same-origin si workaround.
- **Option B**: signed scoped per-asset paths / immutable rewrites; teorikisht kompatibël me importet, por krijon rrezik bearer tokens në URLs, logs, browser history dhe copy/paste (RFC 6750). Për preview privat është **NO-GO pa proof kundër leak/replay dhe revokim per-asset**.
- **Option C**: per-session origin/unguessable hostname capability; lehtëson izolimin por emri sekret është bearer capability, jo user-based authorization. NO-GO si mbrojtje e vetme për private artifacts.
- **Option D**: browser-controlled trusted proxy / edge enforcement me auth për çdo resource pa ekspozuar token në JavaScript/URL; kandidati i preferuar për studim, por duhet të demonstrojë teknologjikisht si autentikohen nested dynamic chunks në sandbox opak. Pa atë provë **nuk ka design GO**.

**PoF2.14 acceptance plan (NOT RUN, requires scoped authorization for code):**
1. Dy owners/tenants A/B, dy sessions, dy immutable manifests me të njëjtin filename; prova pa auth dhe replay të owner B në session A duhet të kthejnë zero bytes (me status të kontrolluar).
2. Valid owner/viewer render, relative ESM imports/chunks HTTP 200, CSS/font/image decode, iframe origin null dhe parent DOM/storage denial; browser desktop/mobile dhe të paktën një engine alternativ përpara release.
3. Cross-tenant script/image/module requests, copied URLs, expired token, logout, revoke, reuse pas delete → FAIL CLOSED edhe në reload, cache, HEAD/range/revalidation.
4. CSP frame-src/ancestors, Origin:null handling, referrer no-referrer, no cookie leakage, CSRF, injection, redirect, DNS/same-site confusion, CORS response headers të testuara në rrjet.
5. Request/byte/time quotas, oversized files/ZIP bombs, malicious paths, compressed content bombs, static host tamper SHA, abusive concurrency dhe atomic revoke/delete; audit logs të redaktuara dhe no secrets.
6. PASS/FAIL/NOT RUN veçmas për authZ server-side, egress, frontend, storage, privacy, accessibility dhe cost. Ruaj manifestet SHA/lockfiles/run links; vetëm fixtures sintetike dhe resources pa pagesë të re.
7. **GO only for further constrained PoC** kur authZ per asset + dynamic chunks kalojnë bashkë; **NO-GO for private production** derisa të plotësohen authentication, HTTPS origin lifecycle, CSP/CORS, privacy, quota, erasure, review, release approval.

**Vendim i këshilluar i PoF2.13:** [BLOCKED] Përdorimi i artifacts private në një public Vite preview host. [PROPOSED] Ndërto PoF2.14 vetëm pas autorizimit të ri për ndryshim kodi / ekzekutim të kufizuar. PoF2.12 mbetet prova e vetme reale Vite HTTP; PoF2.13 përfundoi vetëm si analizë/propozim, pa testim të kodit të ri.

**Definition of Done PoF2.13 (ANALYSIS ONLY):** Threat model, lifecycle, authZ design, evidence/limitations, alternatives and explicit next approval boundary janë të dokumentuara. Kjo nuk zgjidh automatikisht konfliktin teknik të credential-free ESM me user-specific access control.


### PoF2.14 — provë sintetike e capability dhe demonstrim negativ sigurie (2026-10-23)

**[VERIFIED — SYNTHETIC]** Repository eksperimental: https://github.com/titanfit102-bit/my-phone-pof-validation, branch \`feat/pof214-capability-authz-negative-proof\`, commit \`24ed3f5142fc935d696edd666e0406d9c81adc8e\`. [Actions run 39984373498](https://github.com/titanfit102-bit/my-phone-pof-validation/actions/runs/39984373498): \`SUCCESS\`, 22/22 browser/HTTP checks PASS, official Vite v7.3.7. Evidence artifact ZIP SHA256 \`b656c847e021318063974f30cedb01a13e3637e3a644db2d1de98af42cc63c44\`, 4 file ZIP dhe CRC PASS të kontrolluara.

**[IMPLEMENTED ONLY IN PUBLIC VALIDATION BRANCH]** \`pof214/session_host.mjs\` dhe \`pof214/browser_proof.mjs\`. Dy tenants sintetikë (Alice/A, Bob/B), hoste fizike loopback 127.0.0.2 dhe .3, parent 127.0.0.1. Çelës HMAC i rastësishëm gjenerohet vetëm në runtime, jo në source. Control plane mock lejon owner-in për të marrë URL sesioni; çdo GET/HEAD i skedarëve HTML/JS/CSS/PNG kërkon HMAC bearer-capability në path, TTL, revokim dhe hash immutable. U provua ngarkimi zyrtar Vite React, CSS, PNG, lazy ESM chunk HTTP 200, sandbox origin null, bllokim i DOM/storage prind, cross-session fetch, tamper, HEAD/Range, revoke, expiry.

**[CRITICAL SECURITY NEGATIVE, VERIFIED]** Një klient anonim që kopjon URL-në e plotë të sesionit merr HTTP 200: capability URL është bearer token i ripërdorshëm. Kjo nuk është autorizim i bazuar në identitet për çdo asset. Kontrolli i owner-it gjatë minting, HMAC, CSP, frame-ancestors, URL e vështirë për t'u gjetur dhe CORS **nuk** e zgjidhin këtë. 22/22 PASS do të thotë se eksperimenti demonstron si funksionon mekanizmi **dhe** si dështon ndaj replay. Statusi i artifact-it të provës raporton \`PASS_WITH_CRITICAL_SECURITY_LIMITATION\`, \`identityBoundPerAsset: FAIL_NOT_IMPLEMENTED\`, \`privateProduction: NO_GO\`.

**[NO-GO]** Mos e përdor hostin PoF2.14 për kode private, multi-user, tenantë realë, public HTTPS ose Production. Nuk ka autentikim real nga serveri për identitetin e çdo GET/ESM chunk, TLS/origin lifecycle, tenant database, kufij operacionalë enterprise ose garantim privacy. URL bearer në path mund të dalë në log-e, share/copy, analizë browser ose proxy. Kjo është mangësi e arkitekturës, jo thjesht test që mungon.

**[NEXT PROPOSED, NOT IMPLEMENTED] PoF2.15:** analizo në mënyrë read-only një trust boundary të ri për identitetin viewer ↔ each asset ↔ browser ESM sandbox opaque. Krahason mekanizma të shërbimit të kontrolluar nga browser/edge me autentikim per-request, alternative service-proxy që nuk ekspozon creds në kodi të preview-it, explicit user sharing mode vs private mode, CORS/cookie/ESM feasibility dhe replay/caching. Gate i ardhshëm: provë në Chromium ku **stolen URL alone cannot access any HTML, JS, dynamic chunk, CSS, image**, me dy tenants + revoke/expiry, pa dobësuar iframe sandbox. Për implementim kodi në test repo kërko autorizim të veçantë; për dokumentim continuity në branch-in docs autorizimi ekziston.

### PoF2.15 — Architecture decision and explicit private-preview stop gate (2026-10-23)

**STATUS [DESIGN ANALYSIS COMPLETED — NOT IMPLEMENTED/NOT TESTED].** This is the next design review after PoF2.14. All actual GitHub code evidence still points to PoF2.14 commit \`24ed3f5142fc935d696edd666e0406d9c81adc8e\`; no new Vite code, GitHub Actions, infrastructure or production changes were authorized or made for PoF2.15.

**Technical baseline [VERIFIED FROM SOURCE].** \`pof214/session_host.mjs\` verifies only the HMAC-bearing session path, active state, manifest and digest on GET/HEAD; the owner mock controls capability *issuance*. An unauthenticated HTTP client replaying the same URL can download assets. Therefore the existing host has no independent authenticated-viewer identity, cannot be used for private uploads, and client CSP/frame-ancestors cannot prevent direct HTTP GET.

**External browser references [WEB-DOCUMENTED, NOT TESTED HERE].**
- MDN \`crossorigin\` mode: \`anonymous\` means \`same-origin\` credentials; \`use-credentials\` requests \`include\`. https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/crossorigin
- MDN CORS: credentialed requests do not work with ACAO \`*\`; cookie policies, especially in third-party contexts, still apply. https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS
- MDN Storage Access API: sandboxed iframe needs \`allow-storage-access-by-user-activation\`, \`allow-scripts\` and **\`allow-same-origin\`** to request access. This conflicts with our opaque-origin security invariant; do not use that API as the solution. https://developer.mozilla.org/en-US/docs/Web/API/Storage_Access_API/Using
- MDN CHIPS: \`Partitioned\` cookies use site-based partition keys; they are not in themselves proof of identity or proof of how nested ESM requests send credentials. https://developer.mozilla.org/en-US/docs/Web/Privacy/Guides/Third-party_cookies/Partitioned_cookies
- Opaque-origin sandbox requests serialize as \`Origin: null\`; unrelated opaque documents also serialize as \`null\`. Treat Origin:null as **untrusted**. Do not combine credentialed ACAO:null with private assets merely to get imports working; any solution needs independently demonstrated resistance to same-browser cross-origin data reading.

**Product mode split [PROPOSED; USER HAS NOT APPROVED RELEASE].**
1. \`PUBLIC_OR_EXPLICITLY_SHARED_STATIC\`: user affirmatively opts to share a *prebuilt*, nonsecret static output; isolated per-session HTTPS origin, bounded manifest, CSP, allowed resource types, expiry/revoke, clear disclosure that anyone who receives a shared URL can obtain bundled code. The experiment proves parts of rendering, not global-host production operations. Never silently classify ZIP as public.
2. \`PRIVATE_OWNER_LOCAL_FIRST\`: prefer an in-browser processing/rewriting proof that does **not upload** the asset archive to a public service and can keep an opaque sandbox (possibly a bounded static one-bundle conversion or a reviewed local chunk resolver). Feasibility across Vite dynamic imports, CSS/fonts, \`import.meta\`, source maps and memory limits is **UNKNOWN / NOT TESTED**. Repacking arbitrary unknown JS is not yet an authorized feature.
3. \`PRIVATE_REMOTE_AUTHENTICATED\`: blocked pending a proof of identity-bound access on **each** HTML, JS, lazy import, CSS, PNG/font response with no bearer credential embedded in copyable URLs and with an opaque iframe. Avoid creating a production cloud host while this gate is unresolved.

**Candidate designs and adversarial evaluation [PROPOSED].**

| Candidate | Possible benefit | Critical limitation | Decision |
|---|---|---|---|
| Signed capability URL, including per-asset short lived signatures | Works with dynamic ESM without custom headers | Any copied URL with active signature remains a bearer credential; replay, logs and referrer leakage | **REJECT for private** (PoF2.14 evidence) |
| Host-only \`HttpOnly; Secure; SameSite=None; Partitioned\` cookie, viewer bound to server-side tenant/session | URL alone might become insufficient, cookies not accessible through \`document.cookie\` | Need to test cross-origin ESM credentials propagation from opaque origin, third-party blocking, cache, navigation, Firefox/WebKit and dangerous credentialed \`Origin: null\` grants | **TEST HYPOTHESIS ONLY; NO-GO until proven** |
| Storage Access API | Could permit third-party cookies | Requires \`allow-same-origin\` in sandbox; breaks approved opaque-origin invariant | **REJECT under present sandbox** |
| Private auth gateway / trusted parent proxy | Can enforce viewer identity before any asset reaches browser | Native \`import()\` does not add parent authorization headers; proxying \`src\`/chunks via rewriter or trusted resolver remains unproven; a \`postMessage\` bridge is a sensitive capability | **RESEARCH ONLY, not a workaround** |
| Entirely browser-local prebuilt artifact resolver | No upload/shared web URL to steal; no additional cloud cost | Complex Vite chunk/asset mapping, strict no-network CSP and memory bounds; must never execute untrusted content in the Studio origin | **PREFERRED PRIVATE DIRECTION FOR RESEARCH** |
| Separately hosted public/shared static preview | Supports normal HTTP ESM import and cross-origin sandbox, with explicit informed sharing | Code is intentionally available to whoever has public access; NOT private identity-bound access | **CAN BE CONSIDERED with explicit consent and separate security gates** |

**PoF2.16 acceptance test plan [NOT RUN, REQUIRES NEW CODE/CI AUTHORIZATION].**
- Construct only synthetic two-tenant fixtures and a disposable browser host; test sessions Alice/A and Bob/B with the *same* asset filenames but disjoint byte content/digests, and copied URLs.
- Test a new browser context *without* an identity cookie: GET/HEAD/index/.js/lazy-.js/CSS/PNG/font must return no private bytes even if it knows a live URL; test both non-browser HTTP client and browser navigation. Count distinct results, do not use "22 PASS" for negative vulnerability demonstration as a security GO.
- Test the **same browser but unauthorized top-level site**: attempts to iframe, fetch or read asset with opaque \`Origin: null\` must fail, including any \`ACAO: null; ACAC: true\` configuration that can expose private responses. Watch actual request Cookie/Origin/Sec-Fetch-* headers; never rely on Origin as an identity.
- Authorized browser must render official Vite index, initial module, nested lazy module HTTP 200 and PNG/CSS. Verify whether \`crossorigin=use-credentials\` applies to lazy ESM and whether cookie is attached under both normal/private browsing, cookie restriction, and at least Chromium+Firefox before considering compatibility.
- Verify close, logout, expiry, revocation, tenant-switch, cache reload, CDN/proxy caches, conditional GET, \`HEAD\`, \`Range\`, stale tab, concurrent requests and deletion. Server-side controls must apply to *every* asset; \`Cache-Control: no-store\` is necessary but not sufficient.
- Evaluate browser-local alternative separately with the same Vite fixture, but without any public upload; reject external JS, secrets, unsupported \`import.meta\`, source maps and unbounded memory. No \`allow-same-origin\` and no provider tokens in preview code.
- Preserve exact fixtures, lockfiles, SHAs, network HAR with redacted credentials and PASS/FAIL/NOT RUN per gate. A documented browser break or security failure is a valid research result, not reason to weaken the sandbox.
- **GO only to a further restricted synthetic prototype** if URL-only replay is denied while ESM dynamic imports work under a safe origin/credential policy. **NO-GO** for private production until HTTPS/site provisioning, browser matrix, auth revocation, privacy, erasure, abuse limits, and user release approval pass. A screenshot or green workflow is not evidence for all these gates.

**Decision record:** No change to release status. PoF2.14 is real proof of **a replayable bearer credential**, PoF2.15 is only an architecture audit. Next step PoF2.16 requires user permission for *specific code/test edits* in validation repository; ongoing authorization covers only the two continuity documents. Continue other authorized read-only work meanwhile.

### PoF2.16 — test real Chromium HTTPS/CHIPS për Vite ESM, jo garanci Production (2026-10-23)

**[VERIFIED, SYNTHETIC]** Branch i dedikuar në https://github.com/titanfit102-bit/my-phone-pof-validation/tree/feat/pof216-partitioned-cookie-esm-probe , head 4c5232c1ca2e0cb82e06916ccdd10c3756293059. Workflow final [40001595784](https://github.com/titanfit102-bit/my-phone-pof-validation/actions/runs/40001595784): SUCCESS, official vite build në ubuntu-24.04 + Chromium. Evidence artifact SHA-256 25bc182eacdfc9ed318b13f610759678ecfb9cd5dfa4dddec7f281e481691b62, ZIP CRC OK, file results/pof216-experiment.json me **13 PASS, 1 PASS_EXPECTED_DENIAL, 1 BLOCKED_OR_UNPROVEN**. SUCCESS është statusi i ekzekutimit të eksperimenti, **jo** aprovimi i sigurisë private.

**Test design:** host i besuar https://127.0.0.1 dhe dy origin-e sintetike https://127.0.0.2/.3, certifikatë self-signed e gjeneruar dhe shkatërruar në runner; test browser ignoreHTTPSErrors=true. Browser context kishte cookie të injektuar nëpërmjet Playwright, Secure, HttpOnly, SameSite=None, Partitioned (nuk u implementua provider identiteti ose proces login). Serveri kontrollonte cookie sintetik për çdo file GET; bllokon GET pa cookie (401); testoi revokimin, por PoF2.16 NUK implementoi TTL/expiry dhe NUK ekzekutoi test skadimi (NOT RUN). Artefaktet dhe emrat e requesteve u regjistruan pa cookie values/URL token.

**Evidence positive:**
- Browser pranoi cookie Partitioned dhe kërkesa e autorizuar HTML u shërbye 200.
- Rruga standarde Vite stylesheet/module me atributet anonymous fillimisht shkaktoi 401 për CSS. Pasi u përdor crossorigin=use-credentials në link stylesheet dhe në script module, u vërtetuan HTML / initial JS / dynamic lazy chunk / CSS / PNG me 200 dhe cookie të vlefshëm. Origin i module import ishte 'null', por host lejoi credentialed CORS.
- React UI renderoi, klikimi lazy import ndryshoi state-in, imazhi u dekodua dhe iframe mbeti opak (parent DOM + storage denied).
- URL e kopjuar nga një fresh browser context pa cookie mori 401. Prova e modalitetit të CSS/modulit anonymous u refuzua siç pritej. Revokimi refuzoi lexim të ri.
- Një modul minimal Blob me import() u ngarkua brenda iframe-it opak, por **NUK** është proof se Vite multi-chunk build mund të shërbehet plotësisht offline nga ZIP.

**Evidence negative / paqartësi:**
- Testi i sulmuesit me sibling iframe me origin opak nuk arriti të lexojë kodin, por log-u tregoi se kërkesa e sulmuesit **nuk arriti te serveri** (originReached=false). Kjo mund të jetë CSP/browser policy; nuk demonstron se kontrolli i identitetit i reziston çdo iframe-i tjetër. Me ACAO:null dhe ACAC:true, `Origin:null` është i përbashkët për shumë dokumente opake, jo identitet i sigurt për tenant; konfigurimi duhet konsideruar i rrezikshëm.
- Cookie ishte injektuar nga harness, nuk ishte sesi real browser login. Për test siguri private duhen real HTTPS cert trusted, Firefox/WebKit, cross-site attacker pages, cache invalidation, range/HEAD, cookie restrictions, logout/revocation të plotë dhe kontroll identiteti jo vetëm cookie presence.
- Run historik [40000874160](https://github.com/titanfit102-bit/my-phone-pof-validation/actions/runs/40000874160) kishte cookie fixture format invalid. Run [40001072563](https://github.com/titanfit102-bit/my-phone-pof-validation/actions/runs/40001072563) dhe [40001365624](https://github.com/titanfit102-bit/my-phone-pof-validation/actions/runs/40001365624) treguan CSS 401. Vetëm [40001595784](https://github.com/titanfit102-bit/my-phone-pof-validation/actions/runs/40001595784) kaloi plotësisht renderimin e assets në Chromium.

**Decision / release gate:** **PRIVATE PRODUCTION NO-GO**. Credentialed ESM/CSS është teknikisht i mundur në këtë fixture, por konfidencialiteti ndaj iframe-ve të tjera opake, identiteti real dhe vetitë cross-browser nuk janë provuar. Nuk vendoset cookie auth në Studio pa security review. Eksperimenti nuk ka ndryshuar My-phone, PR #12–18, main ose Vercel.

**NEXT PROPOSED PoF2.17:** Prioritizo një provë **browser-local** për të hapur zyrtarisht Vite multi-chunk ZIP në iframe opak pa ngarkim në server dhe pa cookies; provë e ndarë për static assets, import.meta, dynamic ESM, blob origin/storage partition, CSP/CPU/memory, failure/no-network. Kjo ul nevojën për shërbim privat me tenant auth dhe përputhet me objektivin pa kosto/ngarkime. Vetëm me autorizim të shprehur për branch/kod/test të ri. Nëse remote private mode mbetet i domosdoshëm, duhet test më i fortë same-browser sibling fetch që arrihet realisht në asset server dhe provohet authZ për çdo request.

## 9B. Independent Work audit — independently reconciled (2026-10-23)

**Provenance:** uploaded independent audit file MY_PHONE_INDEPENDENT_DEEP_AUDIT_2026-10-23(1).md was read in this conversation. Findings were not accepted blindly; source re-read from GitHub main bf1b65e7, PR17 efa55188, PoF2.16 4c5232c, CI runs PR17 39948253159 / PR18 40002211484 / PoF2.16 40001595784. NO code, test rerun, merge, deployment or paid resources used for this reconciliation. A finding backed by a source path is SOURCE CONFIRMED, not automatically a browser runtime repro.

| Finding | Independent verdict | Reproduction/limits | Priority and required patch/acceptance |
|---|---|---|---|
| A01 ZIP stale callback | SOURCE CONFIRMED | Panel increments epoch only at pick/close; App selection/native does not invalidate pending ticket; deferred E2E NOT RUN | P1; parent context revision + cancel while busy, stale result must never reopen mode/iframe |
| A02 manifest overread | SOURCE CONFIRMED; **CODE FIX VERIFIED IN PR #19 ONLY** | 6 new Node tests + 26 Playwright passed on exact SHA; existing main and PR17 still have old code | P1; stream max 16,384 bytes, cancel/abort, declared header guard, strict UTF8 in PR19; no merge and no new specific browser timeout E2E |
| A03 offline/egress claim | CLAIM/PROOF GAP CONFIRMED | No verified universal network/CPU containment; same-frame navigation attack NOT RUN | P1 gate for hostile ZIP; narrowed trusted-prebuilt copy and adversarial egress/navigation/DoS tests |
| A04 PoF2.16 gates | SOURCE CONFIRMED validation repo | note FAIL does not set process.exitCode; completed experimental run still valid for observed PASS; mutation/fault tests NOT RUN | P1; separate experiment-executed, positive-controls, and security outcome; failing positive controls must fail gate |
| A05 npm advisories | CONFIRMED NEED FOR RECONCILIATION, advisory status SOURCE-CONFLICT | OSV-synced 2026-10-23 metadata lists GHSA-vfj7-8cjw-p6xm withdrawn; GitHub HTML crawler still displayed earlier Oct2 page. GHSA-86w9-cpqp-85rv active. PR17=15H/3M/0C; PR18=4H/3M/0C with identical lock SHA 3cd545615acc0b40092f232476f5e78bbdfc9c7c. No package remediation established. | P1; fresh exact-SHA npm audit when code scope authorized; warning derived from actual exceptional IDs, reviewed/withdrawn triage with no broadening, review deadline 2026-11-21 unchanged |
| A06 100 project cap | SOURCE CONFIRMED | App save setProjects accepts 101, writeProjectRegistry/serialize reject >100; runtime repro NOT RUN | P2 finding but release-gate P1 for reliable user data; reject ahead of state mutation; 99→100→101/edit tests |
| A07 invalid exported backup | SOURCE CONFIRMED | cleanWebUrl allows long URLs; JSON serializer no byte cap; importer UI checks file.size 200000 and parser string.length 200000 (not same UTF-8 bytes); runtime repro NOT RUN | P2 finding, release-gate P1; strict field/count/UTF-8 byte contract + round-trip at boundaries; no silent truncation |
| A08 irreproducible PoF2.10 bytes | SOURCE CONFIRMED | Workflow uploads proof/manifest.json but neither proof/official-expo-web.zip nor fixture package-lock; archive contents not retained | P2; retain synthetic ZIP and lock bytes with digest/manifest proof and retention cap after approval |
| A09 accessibility | SOURCE CONFIRMED missing explicit label/live-status wiring | No manual screen reader test; do not claim universal assistive failure | P2; programmatic labels, status/alert, role/name and keyboard tests; manual SR acceptance |
| A10 stale handoff / TTL | SOURCE CONFIRMED and DOC CORRECTED in this continuity checkpoint | Old master §9 called PoF2.13 next and PoF2.16 claimed TTL test; pof216/cookie_host.mjs has boolean revoke, no expiry fields | P2 documentation; canonical NEXT ACTION above, historical title tagged, TTL marked NOT IMPLEMENTED/NOT RUN; verify both docs agree |

**Advisory evidence quality.** For GHSA-vfj7-8cjw-p6xm, independent OSV mirror from CIRCL states withdrawn 2026-10-23T12:53:02Z while a direct crawled GitHub advisory page remained cached at Oct 2 active metadata. This is an externally grounded status update with a disagreement in surfaced snapshots; treat it as a reason to check authoritative live npm audit/metadata again, not proof of zero vulnerabilities or justification to delete all high-risk exception controls. GitHub node-forge GHSA-86w9-cpqp-85rv still lists affected <=1.4.0 with no patched version. Do not extend 2026-11-21 review date or use npm audit --force. CI discrepancy likely advisory metadata movement, not dependency upgrade, since lock blob is the same.

### Ordered patch plan — proposed only, not authorized code

1. **Documentation now:** this A05/A10 reconciliation plus P0 NO-GO and corrected recovery pointer; do not touch security gate or product README without permission.
2. **P1 product correctness:** A02 **DONE IN DRAFT PR #19 ONLY, VERIFIED CI 40014826947**; no merge into main/PR17. Next A01 import-session cancellation/context generation and deferred browser tests requires separate scoped approval; do not modify PR17 without authorization.
3. **Recovery safety before release:** A06/A07 common MAX_PROJECTS, field-length, UTF-8 bytes and backup round-trip invariants; protect existing localStorage; 99/100/101, long URL and non-ASCII boundary tests.
4. **Proof quality:** A04 positive-control fail gates in validation repository (needs its own authorization), A08 official synthetic fixture lockfile+ZIP evidence in product workflow (needs separate workflow edit approval).
5. **Security scope and a11y:** A03 clarify offline claims, synthetic navigation/no-egress/CPU test; A09 accessible names, async status, keyboard and real screen-reader verification.
6. **Release review:** exact-SHA Node + TS + Expo export/notices + Playwright standard + real official Expo ZIP UI tests; review PR #12–17 dependency order; private remote NO-GO; merge/Production only with explicit authorization.
7. **PoF2.17 only after stabilization and separate approval:** in-browser Vite multi-chunk import without upload, verifying ESM/dynamic assets/import.meta/sandbox/limits/revocation/no network. Blob-only PoF2.16 is NOT Vite ZIP proof.

**Gate evidence:** A01/A02/A04/A06/A07 are high-confidence static flow weaknesses, NOT independently newly reproduced runtime failures in this audit. A03 is claim/coverage gap, not an observed escape. A05 is an evolving upstream advisory state, not package patch. A08/A09/A10 are directly checkable source/docs/provenance issues. Production Vercel SHA/READY remain UNKNOWN; previous Work audit reported 403 and we did not bypass or verify this session.

**Authorization remains restrictive:** This checkpoint may change ONLY docs/CURRENT_STATE.md and docs/MASTER_HANDOFF.md on docs/continuity-checkpoints. No code files, validation scripts, workflows, PR #12–17, main, deployments, cloud, costs, or other repos touched. All proposed patches await exact scope approval.

### A02 implementation checkpoint — isolated Draft PR #19 (2026-10-23)

- **Exact refs:** [Draft PR #19](https://github.com/titanfit102-bit/My-phone/pull/19) base `main`, head `fix/a02-bounded-live-sync-reader`, commit `01e6527e917486c1eea83bf97250241d205b9ca3` started from the verified main `bf1b65e72760dca5c8dd2fb92e9c79b65f77c6df`. NOT a change to PR #12–17 or Vercel.
- **Modified source:** `studio/src/live-sync.js` adds a streamed fixed 16,384-byte reader for build-info.json. `studio/App.tsx` replaces unbounded `response.text()` and preserves existing poller timeout, disabled/visibility guards, state transitions and stale-result suppression. `studio/tests/live-sync.test.mjs` adds six unit cases for streamed oversize, early Content-Length rejection, incorrect headers, exact byte limit, UTF8/invalid bytes and AbortError.
- **Evidence:** [Exact SHA GitHub Actions 40014826947](https://github.com/titanfit102-bit/My-phone/actions/runs/40014826947) SUCCESS. Node 47/47 PASS, Playwright desktop/mobile 26/26 PASS, TS/export PASS. PR19 three-file diff independently checked.
- **Limitations:** CI is baseline main plus isolated A02 only, **not** the stacked PR17 full 98/98 fixture suite; no official Expo PR17 import was re-executed with A02 integrated. The main and PR17 continue to expose the original unbounded body read. A02 is **not closed for Production** until separately authorized integration and release verification. Byte streaming protects app-side accumulation but cannot bound all browser transport buffers/remote server workload.
- **Next stage and scope:** A01 parent-child ZIP pending upload invalidation/cancel, exact browser deferred result test. Requires separate permission to edit code. Preserve PR #19 Draft and continuity PR #18 documentation-only.

## 10. Autorizimet e qëndrueshme dhe kufijtë absolutë

**[USER AUTHORIZED]**:
- Krijimi fillestar i degës docs/continuity-checkpoints nga main, krijimi i docs/CURRENT_STATE.md dhe docs/MASTER_HANDOFF.md, dhe **Draft PR vetëm për dokumentacion**.
- Përditësim i vazhdueshëm **vetëm i këtyre dy dokumenteve brenda kësaj dege**, pas ndryshimit material të verifikuar. Pa leje të re për çdo checkpoint. Përditëso seksionet e prekura, jo gjithë historikun pa arsye; ruaj aktualizim commit, readback, report.
- Analizë/read-only e My-phone dhe repo validimi, projektim PoF2.13 pa ndryshim kodi.

**[NOT AUTHORIZED]**: krijim/edit/delete skedarësh të tjerë; edit i PR #12–17; merge në main; ndryshim i prod/Vercel; prod secrets/cloud/paid services; modifikim repos të tjera ose detyra që rrezikojnë të dhëna reale. Autorizimi i vazhdueshëm i continuity **nuk zgjeron** autorizimin e kodit.

**Workflow pas çdo ndryshimi material**:
1. Verifiko actual GitHub SHA dhe run logs; ndaj “implemented”, “tested” dhe “released”.
2. Ndrysho CURRENT_STATE me latest heads, CI, blockers dhe next action.
3. Ndrysho vetëm fragmentet e nevojshme të MASTER_HANDOFF (vendime të reja, plan/risk, evidencë).
4. Commit **vetëm dy skedarët e lejuar** në docs/continuity-checkpoints me expected SHA (lease).
5. Fetch nga GitHub të dy docs, verifiko head dhe që Draft PR mbetet dokumentacion-only; raporto statusin “i përditësuar” vetëm pas suksesit. Në dështim raporto “në pritje të ruajtjes”.
6. Asnjë background monitoring automatik nga biseda; rikuperimi kërkon hapjen e bisedës ose workflow të veçantë të autorizuar.

## 11. Mungesat e kontekstit dhe e vërteta e checkpoint-it

Ky MASTER_HANDOFF u hartua nga historiku i arritshëm i bisedës së projektit dhe dokumentet/refet GitHub të lexuara, **jo** nga çdo bisedë e mëparshme e mundshme. Raportet dhe ZIP-et historike të krijuara vetëm në bisedë nuk janë domosdoshmërisht të ruajtura përgjithmonë në GitHub; përdor run URLs, commits dhe dokumentacionin repo. Nuk ka verifikim aktual të Vercel READY/Production në këtë checkpoint. Nuk ka akses provues te backend/hosting private, logs runtime reale, pagesat, apo ndonjë model i plotë kërcënimesh kundër kodit armiqësor. Në bisedat e reja ndaji qartë informacionet e verifikuara nga supozimet.

**Checkpoint-i quhet i ruajtur vetëm pas GitHub commit + readback + Draft PR check.** Nëse një bisedë ndërpritet, lexo branch-in e mësipërm, kthehu te veprimi i fundit real, dhe vazhdo brenda autorizimit.
