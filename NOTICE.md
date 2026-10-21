# License and attribution notices

No repository-wide open-source license has been selected for this project's
original code. Making the repository public does not by itself select MIT or
relicense that code. This notice preserves the existing license status; it does
not grant additional rights to the original code or alter GitHub's terms.

Third-party components retain their respective licenses:

- Each new `npm run export:web` includes `dist/THIRD_PARTY_NOTICES.txt`, containing
  the full license and attribution texts for dependency packages found in the
  emitted Metro bundle source maps. These third-party licenses apply to those
  components, not to the whole project.
- `studio/licenses/react-native-MIT.txt` contains the upstream MIT license for
  two pinned React Native package versions that omit it from their npm archives.
  `studio/licenses/upstream-license-sources.json` records the exact upstream
  source commits and SHA-256. Upgrades require a new review of these entries.
- The DejaVu font test fixture is covered by
  `studio/tests/FONT_FIXTURE_LICENSE.txt`. Keep that license with copies of the
  fixture or test artifacts containing it.
- Failure artifacts include Playwright/Playwright Core LICENSE, NOTICE and
  ThirdPartyNotices files alongside their report/trace assets.

Historical GitHub Actions artifacts are immutable copies. This change does not
amend their contents or delete any artifacts. Older exports that lack complete
notices remain an open publication-audit item until their retention expires or
the owner explicitly authorizes a separate remedy.

See `docs/PUBLIC_CI_LICENSES_AND_WORKFLOWS.md` for the build process and remaining
repository-level security settings.
