# Onboarding Remediation — Fable Dispatch Index

**Date:** 2026-07-18
**Status:** Ready for Fable
**Source audit:** [2026-07-18-onboarding-adversarial-audit.md](file:///E:/tka-platform/docs/superpowers/specs/shipped/2026-07-18-onboarding-adversarial-audit.md)
**Owner:** Austen

## What this is

The adversarial onboarding audit surfaced 41 verified findings across 10
dimensions. They are packaged into **7 remediation specs**, grouped by shared
root cause and fix pattern (not one spec per finding). Each spec is a handoff
artifact for Fable: it carries the verified evidence (file:line), the
requirements, a recommended approach, the open design questions Fable owns, and
a checkbox acceptance ledger.

Two audit findings are deliberately NOT in any spec:
- `landing-no-signin-link` — REFUTED on recheck (link exists in
  `src/routes/+layout.svelte`; earlier grep scoped only landing components).
- `createtutorial-crossfade` — PLAUSIBLE not confirmed; folded into Spec 4 as a
  flagged P3, not a mandate.

## Dispatch order (highest leverage first)

Instrument first so every later change is measurable, then close the state and
security leaks (shared fix pattern), then a11y, then the polish/sweep.

| # | Spec | Sev | Design surface | File |
|---|---|---|---|---|
| 1 | Analytics & funnel instrumentation | P0+P1 | event taxonomy — Fable defines catalog | [spec](file:///E:/tka-platform/docs/superpowers/specs/shipped/2026-07-18-onboarding-analytics-instrumentation.md) |
| 2 | Per-account state hygiene + cloud sync | P1 | mostly mechanical (copy first-run-state pattern) | [spec](file:///E:/tka-platform/docs/superpowers/specs/shipped/2026-07-18-onboarding-account-state-hygiene.md) |
| 3 | Firestore security hardening | P1+P2 | security-sensitive + needs deploy | [spec](file:///E:/tka-platform/docs/superpowers/specs/shipped/2026-07-18-onboarding-firestore-security.md) |
| 4 | Onboarding accessibility + component polish | P1+P2/P3 | primitive choice per overlay | [spec](file:///E:/tka-platform/docs/superpowers/specs/shipped/2026-07-18-onboarding-accessibility.md) |
| 5 | Silent work-loss elimination | P1+P2 | per-sequence sync-status UI | [spec](file:///E:/tka-platform/docs/superpowers/specs/shipped/2026-07-18-onboarding-silent-work-loss.md) |
| 6 | Nudge copy + export-gate consolidation | P1+P2/P3 | copy — owner voice | [spec](file:///E:/tka-platform/docs/superpowers/specs/shipped/2026-07-18-onboarding-nudge-copy-export-gate.md) |
| 7 | Dead-code & drift sweep | P2/P3 | verify-before-deleting | [spec](file:///E:/tka-platform/docs/superpowers/specs/shipped/2026-07-18-onboarding-dead-code-sweep.md) |

## Cross-cutting rules every spec inherits

- `commit-only-your-own-changes.md` — scoped commits, explicit pathspec.
- `verification-protocol.md` — evidence before "done" (test/build/grep/runtime).
- `never-hand-roll.md` / `primitive-discovery.md` — reuse existing primitives.
- `fable-routing.md` — Fable plans/reviews; Sonnet executors do mechanical edits.
- Specs touching `firestore.rules` (Spec 3) need `firebase deploy` — owner-gated.

## Deploy-gated work (flag before claiming done)

- Spec 3: `firestore.rules` changes need `firebase deploy --only firestore:rules`.
- Any Firebase functions change needs redeploy (see `reference_firebase_functions_deploy_host`).
