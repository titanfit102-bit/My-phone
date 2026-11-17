# A09 — Accessibility acceptance (Expo Studio, Draft)

**Scope:** My Phone Expo Studio; changes are limited to programmatic field labels, keyboard navigation, and dynamic-status announcements in the browser/React Native UI.

## Automated evidence (pending exact SHA GitHub Actions)

- Form inputs must expose stable accessible names even if placeholders change: EMRI, GITHUB REPOSITORY, WEB PREVIEW URL and APPETIZE EMBED URL.
- A user must be able to open the form, tab between fields in reading order, and submit with Enter, with the same persisted result as clicking.
- The icon-only form close action must be announced as “Mbyll formularin”, not merely multiplication sign.
- Backup outcome and ZIP upload feedback must be announced via polite live regions; Live Sync detail and pending version also expose polite updates, without claiming the deployment is verified.
- Existing errors for invalid forms and unreadable registries remain assertive alerts. The ZIP picker is disabled while it processes a file.
- Browser regression runs in desktop Chromium and emulated mobile Chromium. This does NOT simulate TalkBack/VoiceOver/NVDA output.

## Manual screen-reader and physical-device gate — NOT RUN

1. **Windows desktop, NVDA + Chrome:** navigate from project list to mode buttons, ZIP upload, backup actions, add/edit form and Live Sync. Verify announced field label, role, order and state; check repeated announcements are tolerable.
2. **Android device, TalkBack + Chrome:** swipe between interactive elements, use the software keyboard, submit/error corrections, test recovery confirmation, ZIP cancellation and Live Sync updates. Verify no trapped focus in parent or iframe.
3. **iOS Safari + VoiceOver (where available):** confirm controls, dialogs/statuses, and any iframe boundary are traversable. The Web Studio does not claim equivalent native Expo behavior.
4. **Keyboard-only desktop:** test Tab/Shift+Tab, Enter/Space for all buttons, Escape behavior where applicable (not asserted as supported), visible focus indicators, plus scroll/reflow at 200% zoom.
5. **Status announcement semantics:** real assistive technology can differ in how it announces a mounted region with text; audit with user interactions that *change* content and report any missed announcements.
6. **Manual WCAG review:** headings/landmarks, contrast, focus visibility, error association and instructions, target size, dynamic content priority, reduced motion where appropriate. Browser-only tests are not an accessibility conformance certificate.

## 2026-11-10 — Manual Android Chrome + TalkBack candidate acceptance protocol (NOT RUN)

**Intent:** collect *real device* evidence on the proposed Web Studio, not on the unmerged native APK. GitHub A09 emulator automation is **NOT ACCEPTED** after seven failed CI runs (OS launcher ANR and test-harness issues); do not repeatedly trigger the same runner. [Draft PR #32](https://github.com/titanfit102-bit/My-phone/pull/32) remains OPEN/UNMERGED. The current A05 lockfile security candidate and Android debug APK compilation are independently proven but **do not certify accessibility**.

### Exact target and scope
- **Candidate web Preview** (read-only Vercel metadata, 2026-11-10): `https://my-phone-studio-ps8bbf6fs-un24.vercel.app`, deployment `dpl_967NvVE3cPAANVPer1MeVTV91BmQ`, **READY**, target Preview (not Production), Git ref `fix/a05-sdk57-lockfile-dependency-refresh`, exact Git SHA `57198a7dafc07f475f248391cc6a6e8515df1b35`. Preview authentication or access in Chrome **has not been checked**; if blocked by Vercel authentication, record BLOCKED and use a properly authorized account; do not bypass access control. [Vercel inspection](https://vercel.com/un24/my-phone-studio/967NvVE3cPAANVPer1MeVTV91BmQ).
- **Production comparison only**: `https://my-phone-studio.vercel.app`, Vercel target Production READY on `main` SHA `bf1b65e72760dca5c8dd2fb92e9c79b65f77c6df`. Production is **NOT** the candidate and passing it cannot close A09 on PR32.
- Use an Android **physical device + Chrome + TalkBack**, ideally a clean browser profile/incognito to avoid mixing the real Studio localStorage with synthetic test data. Do **not** use a hostile ZIP, unrelated app, personal data, private tokens, or a paid Appetize session. The optional native debug APK is a distinct Metro-assisted artifact, NOT the Web candidate.
- Enable TalkBack via Android Settings → Accessibility → TalkBack (Samsung settings wording may vary); swipe right/left between elements, double-tap to activate focused controls, two-finger swipe to scroll. [Official Android guide](https://support.google.com/accessibility/android/answer/6007100?hl=it-it). Record OS/Chrome/TalkBack versions, not device identifiers or private account details.

### Manual checks — each explicitly PASS / FAIL / BLOCKED / NOT RUN
| ID | Interaction on physical Chrome | Required evidence / expected result |
| --- | --- | --- |
| A09-M01 | Open the **exact candidate Preview** URL; note whether Vercel authentication appears | Correct Studio Web screen renders; no login workaround; deployment ref/SHA verified from Vercel metadata |
| A09-M02 | Turn on TalkBack; swipe across project list, project-add button, **Expo Web Preview** / **Android Cloud APK**, ZIP import and backup buttons | Descriptive names and button roles, meaningful reading order, no focus trap or silent icon-only controls |
| A09-M03 | Activate `+ Shto` or `+ Lidh aplikacionin` | Form opens and focus remains navigable; icon-only close control is read as **Mbyll formularin** |
| A09-M04 | Traverse the form **without submitting real data** | **EMRI**, **GITHUB REPOSITORY**, **WEB PREVIEW URL (opsionale)** and **APPETIZE EMBED URL (opsionale)** each have announced programmatic labels independent of placeholder |
| A09-M05 | Try invalid/empty form submit on disposable browser state; then cancel | Error is announced as an alert, corrections are accessible, closing restores navigation; no real project is altered |
| A09-M06 | Test backup/status notices using disposable data only, if safe | Dynamic status changes are announced once via polite live region; do not import/overwrite a real registry |
| A09-M07 | Open ZIP picker and cancel **without importing a ZIP** | File selection/cancel does not trap TalkBack focus; if a trusted owned prebuilt ZIP is tested later, record separately (not hostile ZIP support) |
| A09-M08 | Rotate portrait/landscape and test Chrome font scaling/zoom where supported | Text remains readable; actions can be reached by normal scrolling; no covered form buttons |
| A09-M09 | With an **owned and safe** linked Web preview only, navigate into and out of iframe | No trapped focus; boundary and preview status explained accurately. If no safe fixture: **NOT RUN**, never mark PASS |
| A09-M10 | Repeat high-priority form navigation in Chrome with TalkBack off, then compare | Distinguish accessibility-only failure from general mobile functionality |

### Evidence record (do not prefill PASS)
- **Execution date/time:** NOT RUN
- **Environment:** physical device model / Android version / Chrome version / TalkBack version: NOT RECORDED
- **Target:** candidate Preview URL and immutable SHA `57198a7d...` above; verify this exact deployment still exists when testing
- **Results:** M01–M10 = **NOT RUN** until executed by a human, or **BLOCKED** only after a real attempt
- **Bug report:** step ID, observed spoken phrase vs expected phrase, screenshot/video only without private data, severity, and reproduction steps
- **Review:** no A09 acceptance until critical navigation/form/status defects are resolved and test evidence is recorded. Browser desktop/Chromium CI is supplemental and is **not** TalkBack acceptance. iOS VoiceOver and Windows NVDA remain separately NOT RUN.

**Release control:** A09 NOT ACCEPTED; SEC-04 hostile ZIP limitations, SEC-13 branch protection, the two residual Moderate advisory roots and all required checks remain open independently. **NO MERGE / NO DEPLOY / RELEASE NO-GO** until explicit review and authorization.

## Release restriction

Do not call A09 complete for real screen readers or physical devices until manual evidence, device/build identifiers, assistive technology versions and results are recorded. Keep security audit and release gates unchanged. No merge or deployment authorized.
