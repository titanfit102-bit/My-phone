# A03 / A04 — ZIP Preview security boundary and evidence-gate contract

**Status:** Draft-only verification; not a Production or release authorization. Applies only to `My Phone Expo Studio` and its trusted prebuilt Quick Preview paths.

## A03: accurate containment model

- Studio renders supported **user-trusted, prebuilt** Vite/Expo bundles in a temporary `srcDoc` iframe with `sandbox="allow-scripts"` and no same-origin/top-navigation/popup capabilities. It does not build user source or start a backend.
- Both built-in CSPs block fetch/connect, remote images, frame creation, workers, forms, and object embedding within the original `srcDoc` document. Parent DOM/localStorage are inaccessible from its opaque origin.
- **Not a universal network/CPU sandbox:** a script can attempt to navigate its **own** iframe to a remote URL. CSP `connect-src 'none'` does not guarantee denial of document navigations; Chromium does not enforce `navigate-to` universally. Iframe sandbox blocks top-level navigation but does not categorically prevent same-frame navigations. The request may reach the network, even if the destination document cannot access parent data. Browser-level CPU exhaustion is also not preempted. Do not assert a zero-egress boundary for hostile JavaScript.
- Browser regression uses a locally intercepted HTTPS URL (`a03-boundary.example.test`) to document this **known limitation** and verifies no parent navigation. Another regression checks that the CSP prevents nested frame and worker resource requests.
- **Security decision:** do not accept unknown/hostile ZIPs on an assumption of zero-network isolation. When true hostile-code support is required, design isolated origins/processes, strict network policy at a controlled host, CPU/memory/time quotas and independent review before enabling that mode. Private Vite remote handling remains NO-GO.

## A04: distinguish three outcomes

1. **Experiment executed:** reproducible evidence exists and the run completed.
2. **Positive controls passed:** the nominal observation was detected AND deliberately injected failure was detected. Missing/false/duplicate controls must return nonzero process exit in the evidence CLI.
3. **Security finding:** vulnerability statuses (e.g. `CRITICAL_LEAK`, `FAIL`) are surfaced independently of the validity of an experiment. Successful experimental execution may expose a security failure; it must never imply Production approval.

`studio/src/proof-evidence-gate.js` evaluates versioned proof metadata; `studio/scripts/verify-proof-evidence.mjs <report.json>` exits nonzero for absent/invalid evidence or failed mandatory controls. Node regression launches the actual child process with deliberately missing/failed controls and confirms nonzero exit codes. Its `securityReview="NO_RECORDED_FAILURE"` is not a release certificate.

**Boundary:** Original PoF2.16 uses `note("FAIL")` without guaranteeing nonzero process exit in the **separate** `titanfit102-bit/my-phone-pof-validation` repository. The original experiment can still be scientifically informative while its evidence-positive CI gate is incomplete. This PR does **not** modify that repository. Integration of this gate into its workflow requires separate scoped approval, independent CI and explicit review.

## Gates outstanding

- Full functional GitHub CI on exact code commit and adversarial browser tests.
- Vendor-supported Zod/Expo dependency remediation (standard security gate still blocked).
- Manual physical device and screen-reader verification, and any production isolation design for arbitrary hostile ZIP execution.
- Approval before merging or deploying. No private ZIPs or credentials were used in these synthetic tests.
