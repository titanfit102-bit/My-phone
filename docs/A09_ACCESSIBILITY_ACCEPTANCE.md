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

## Release restriction

Do not call A09 complete for real screen readers or physical devices until manual evidence, device/build identifiers, assistive technology versions and results are recorded. Keep security audit and release gates unchanged. No merge or deployment authorized.
