# My Phone Studio — Security advisory triage (2026-10-21)

**Status:** two unpatched high-severity root advisories; **15 high / 7 moderate / 0 critical** paths at baseline. This is **not** a clean bill of security health.

## Evidence and scope
- Source: npm audit (production dependency classification) on the Expo Studio lockfile in PR #4's branch; original failure run: [39507045636](https://github.com/titanfit102-bit/My-phone/actions/runs/39507045636).
- Lockfile path: `studio/package-lock.json` (merged and used by the current Studio CI).
- Version: Expo ~57.0.0 resolved as 57.0.30; React Native 0.86.0; build output is a **static Expo Web export**, not an exposed Node.js production service.
- The flagged code belongs chiefly to **transitive CLI/Metro/build-time dependencies**. Installed production-dependency categorization by npm does not prove those packages execute inside the deployed browser bundle. **No code reachability assessment or incident investigation has been completed.**

## Root causes and vendor advisories
| Root package | Installed | Advisory | Upstream patch | Where it appears |
|---|---|---|---|---|
| `braces` | 3.0.3 | [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) | **No official patched release listed as of 2026-10-21** | `micromatch` → Metro/file-map/Expo CLI paths |
| `node-forge` | 1.4.0 | [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv) | **No official patched release listed as of 2026-10-21** | Expo code-signing certificate tooling |
| `uuid` | 7.0.3 | [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) | Patched in other major versions; currently **Moderate** in `xcode`/Expo config tooling | transitive; future dependency compatibility review |

**15 high findings are package-chain counts, NOT proof of 15 distinct exploited vulnerabilities.** npm audit suggested `--force` would downgrade Expo to 44; **do not** accept that breaking change. Patching/replacing packages by arbitrary Git forks is not an acceptable silent workaround.

## Mitigation selected (implemented CI policy; advisories not fixed)
1. Keep lockfile + `npm ci`, no automatic forced changes.
2. Add a **fail-closed** JSON audit gate that blocks *any new* high-severity root advisory, any critical advisory, malformed audit response, or growth above the baseline of 15 high paths.
3. Only the two reviewed GHSA identifiers above are temporarily accepted, **until 2026-11-21**; they remain visible in CI and are not claimed fixed.
4. CI uses read-only GitHub permissions, builds to static `dist`, and never exposes Expo/Metro as a public Node process.
5. Re-review advisories monthly or before granting private GitHub/Vercel API credentials. If a compatible vendor fix becomes available, make a separate scoped dependency PR and remove its exception.

## Security evaluation still required
- Verify whether untrusted, deeply nested brace patterns can reach `braces` during a build or asset scan; deny untrusted build jobs before merge.
- Verify whether RSA PKCS#1 v1.5 verification of low-exponent keys can be used in any actual Expo signing path relevant to this Studio. Avoid untrusted certs; do not assume advisory has zero impact merely because the shipped web app is static.
- Review `uuid` upgrade compatibility within Expo native tooling, including impact on `xcode`. No forced major override.
- Add a non-production regression fixture for both packages if a verified fix lands.
- Avoid interpreting a green CI with approved exceptions as zero risk.

## Explicit release guardrail
Until the review: do not start a public Node service from Expo/Metro, do not process untrusted glob patterns, do not use Studio's build tooling to validate untrusted signing certificates and do not add privileged provider tokens.
Historical note: triage PRs #4/#5 were merged following authorization. Current `main`/Production must be checked using GitHub and Vercel; this note is not a release-status claim.
