# Public CI, license packaging and workflow security

Scope: only `titanfit102-bit/My-phone`. This follow-up is based on PR #15 HEAD
`53cf53d79854876536377aa520650aef4621bd43`; no merge or Production release is
part of this work. It does not change the app, ZIP parsing limits, sandbox/CSP,
security advisory exceptions, or the existing test suite's expectations.

## Web export and license coverage

`npm run export:web` runs the existing local Expo CLI with `--source-maps` in a
temporary directory under ignored `studio/node_modules/.cache/`. The notice
generator inspects every emitted map, including indexed map sections and nested
dependency versions, and copies each package's complete LICENSE/COPYING and
NOTICE/COPYRIGHT documents. It does not infer permission text from an SPDX label.
Missing maps, unresolved dependency sources or missing license text fail the
build. Nonempty sourceRoot layouts are explicitly rejected, including inside
indexed sections, rather than silently skipping relative dependency paths. The
current Metro export uses rooted source entries. No runtime network request is
used to fetch license texts.

Two upstream texts missing from npm packages are checked in with exact package
versions, upstream gitHead commits from npm metadata and SHA-256 verification.
The recorded source is the React Native repository's LICENSE at each commit.
Changing one of those package versions without reviewing its fallback fails
closed. A NOTICE alone or blank LICENSE is insufficient.

Only after license coverage succeeds is the generated local `studio/dist/`
replaced. Source maps stay out of the final export, and sourceMappingURL comments
are removed to avoid broken links to the excluded maps. The original Expo bundle
filenames and executable code are retained. The existing metadata emitter then
writes build-info.json. Local generated staging/output cleanup never deletes
GitHub artifacts, commits, branches or history.

The final `THIRD_PARTY_NOTICES.txt` travels inside the Web export ZIP and Vercel
output. Do not remove it when copying or hosting that export. This process covers
packages identified by the current Metro JavaScript export. Review the rights
and attribution of any newly introduced standalone assets or vendored code;
source-map package inventory alone cannot establish their provenance.

The repository's original code has not been relicensed. `NOTICE.md` explains its
unchanged status. A future choice of a repository-wide license is an owner
decision, separate from packaging third-party notices.

## Workflow changes

- Keep `ubuntu-latest`, Node 22, contents:read, all existing gates, timeouts and
  artifact retention periods.
- Pin checkout, setup-node and upload-artifact to exact upstream v4 commit SHAs,
  resolved from the official repositories on 2026-10-21. Checkout's commit is
  `11d5960a326750d5838078e36cf38b85af677262` (verified upstream commit, current v4).
  setup-node is v4.4.0 and upload-artifact is v4.6.2. Pinning requires periodic
  upstream/security review; mutable v4 tags no longer change this workflow.
- Disable checkout's persisted credentials; this build does not need git push.
- Cancel superseded runs of the same workflow/event/ref. Push and PR contexts
  have different groups, and the exact PR #15 baseline rerun is unaffected.
- Check React/MIT notices in the final output before artifact upload.
- Include the font fixture license and Playwright's distributed LICENSE/NOTICE/
  ThirdPartyNotices with failure reports. No existing artifact is overwritten or
  removed by this change.

The workflow still runs the full desktop/mobile Playwright suite and the
dependency advisory gate. The existing upstream exceptions are unchanged; a
green gate does not mean those advisories are fixed.

## Settings outside this PR

GitHub's public-fork workflow approval policy and branch/ruleset protection are
repository settings, not established by this YAML. Review approval requirements
for outside contributors and protect main with the appropriate required checks
after deciding the stacked PR integration order. Keep the default token read-only
and do not execute untrusted PR code with secrets or write permissions. No
settings change is included in this PR.

Older license-incomplete artifacts, including the exact historical baseline run
re-executed before this fix, remain unchanged. They must expire or receive an
explicitly authorized separate remedy; this PR does not claim retroactive
cleanup. Public-fork/clone copies cannot be recalled by changing visibility.
