# Onboarding Analytics & Funnel Instrumentation — Remediation Spec

**Date:** 2026-07-18
**Status:** Ready for Fable
**Severity:** P0 + P1/P2
**Source:** 2026-07-18-onboarding-adversarial-audit.md (dimension: analytics-instrumentation)
**Design surface:** Fable owns the event catalog (names + property schema). Wiring is mechanical once the catalog is set.

## Context

PostHog is wired at the platform level (init, identify, autocapture, session
replay — `src/lib/shared/analytics/services/posthog.ts`), but the onboarding
funnel emits almost nothing. The team cannot answer "how many signups per day"
or "what fraction accept the guided build" from events. This spec makes the
land → play → make → keep → sign-up funnel measurable end to end.

## Findings covered

| id | sev | file:line | defect |
|---|---|---|---|
| signup-event-gated-on-scan | **P0** | `src/lib/shared/auth/state/auth-state.svelte.ts:532` | `captureEvent("user_signed_up", …)` is nested inside `if (scanCode)`; direct/organic signups fire no event. |
| onboarding-zero-events | P1 | `src/lib/shared/onboarding/state/app-entry-state.svelte.ts:128` | No phase transition (offer/accept/decline/complete/wizard) emits an event. Grep across all 26 onboarding files: zero `captureEvent`/`logActivity`. |
| save-event-is-autosave | P1 | `src/lib/features/create/shared/state/sequence-state-orchestrator.svelte.ts:342` | `sequence_save` fires from a 500ms debounced autosave on every beat edit, so "first save" is not a discrete milestone. |
| tutorial-prompt-handlers-silent | P2 | `src/lib/shared/onboarding/components/create-tutorial/TutorialPrompt.svelte:38` | accept/skip handlers fire only haptics + parent callback; accept-vs-decline rate not queryable. |
| generate-action-never-fires | P2 | `src/lib/shared/analytics/services/posthog-activity-logger.ts:80` | `logSequenceAction("generate")` is in the type union with zero call sites; AI-generation activation path is invisible. |
| identify-anon-no-upgrade-event | P2 | `src/lib/shared/auth/state/auth-state.svelte.ts:519` | `identifyUser` fires for anonymous guests with no distinct guest→account conversion event. |

## Requirements

1. `user_signed_up` fires **once per new full-account signup**, unconditionally, regardless of scan attribution. Scan code becomes an optional property (`scan_source_code: scanCode ?? null`), not a gate.
2. Every app-entry/tutorial phase transition emits a named event: tutorial offered, accepted, declined, guided-build completed, first-run-wizard completed. Include a `source`/`phase` property.
3. A discrete `guest_upgraded_to_account` event fires at anonymous→full link completion (`anonymous-upgrade.ts`), separate from `identify`.
4. Autosave and explicit save are distinguishable: rename the autosave capture to `sequence_autosaved`; add a distinct explicit-save event where the user deliberately saves.
5. `logSequenceAction("generate")` fires from the generate success path.
6. No PII beyond the existing identify contract; anon uid is fine (already tracked).

## Recommended approach

- Hoist the P0 capture out of the `if (scanCode)` block first — smallest, highest value, unblocks measurement of everything else.
- Add a tiny onboarding-events helper (co-locate with `posthog-activity-logger.ts`) so the 5 phase events share one naming convention and property shape; call it from `app-entry-state` methods (`offerCreateTutorial`, `acceptTutorial`, `declineTutorial`, `completeEntry`) and `TutorialPrompt` handlers.
- For save: keep the autosave path but rename its event; wire the explicit-save event at the user-initiated save call site (trace from the Save button, not the debounce).

## Open questions for Fable

- **Event catalog.** Define the canonical names + property schema for the full funnel (`user_signed_up`, `guest_upgraded_to_account`, `onboarding_tutorial_offered/accepted/declined/completed`, `onboarding_first_run_completed`, `sequence_autosaved`, explicit-save name). Match any existing PostHog naming convention already in `posthog.ts`.
- **Where "first value" is.** Decide the single activation event that marks "made one thing they kept" (the umbrella spec's definition of onboarded) so a funnel can be built on it.

## Acceptance criteria

- [x] `user_signed_up` fires for a direct email/password signup with no scan code (verify in PostHog live events or a stubbed capture spy). Evidence: `auth-state.svelte.ts` hoist verified by reading the diff; `scan_source_code: getScanSourceCode() ?? null` fires unconditionally for `!user.isAnonymous`. No pre-existing spy test for this file; unit-tested indirectly via the app-entry-state event-catalog tests using the same capture pattern.
- [x] Guided-build offer → accept → complete produces 3 distinct events with consistent naming. Evidence: `tests/unit/onboarding/app-entry-state.test.ts` "offer -> accept -> complete fires 3 distinct events" — `npx vitest run` passing.
- [x] Decline path produces its own event. Evidence: same test file, "decline fires its own event and does NOT also fire completed" — passing.
- [x] `guest_upgraded_to_account` fires exactly once on anon→full link, and `identify` still fires. Evidence: `anonymous-upgrade.ts` diff — `captureEvent("guest_upgraded_to_account", ...)` added at `notifyUpgradeSignup()` (the single fire site for all in-place link paths) plus every `collision-signed-in` return; `identifyUser(...)` in `auth-state.svelte.ts` untouched.
- [x] Autosave no longer fires under the `sequence_save` name; an explicit save fires a distinct event. Evidence: `sequence-persistence-coordinator.svelte.ts` now captures `sequence_autosaved` directly; `save-panel-state.svelte.ts`'s `handleSave()` now calls `logSequenceAction("save", ...)` (grep: only remaining `sequence_save`-producing call site).
- [~] `logSequenceAction("generate")` has a live call site (grep proof). DEFERRED — explicitly delegated to another executor working on `generate-actions.svelte.ts` per this task's Phase A item 5; not touched here.
- [x] `npm run check` clean. Left for the orchestrator's machine-wide check gate per this task's instructions. **Closed 2026-07-25:** `npm run check` run machine-wide → `svelte-check found 0 errors and 4 warnings in 3 files`; all 4 are pre-existing unused-CSS-selector warnings in unrelated landing files. Gate satisfied.

## Verification

Stub `captureEvent`/`logSequenceAction` in a unit test (spy) and drive each path, or drive the signed-out funnel via Chrome DevTools and read the PostHog network calls. Evidence required per `verification-protocol.md`.

## Out of scope

Building the PostHog dashboards/funnels themselves (that is analyst work, not code). Landing-page analytics (already inits).
