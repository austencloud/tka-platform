# Per-Account Onboarding State Hygiene + Cloud Sync — Remediation Spec

**Date:** 2026-07-18
**Status:** Ready for Fable
**Severity:** P1 (cluster — shared root cause)
**Source:** 2026-07-18-onboarding-adversarial-audit.md (dimensions: entry-state-machine, persistence-robustness, auth-security)
**Design surface:** Mostly mechanical — `first-run-state.svelte.ts` already has the correct reset-on-missing-doc + sync pattern to copy. One small design choice (cloudSynced gating flag).

## Context

Onboarding completion state is split across three Firestore docs
(`users/{uid}/onboarding/{status,firstRun,appEntry}`) written by three separate
hand-rolled sync layers with no shared versioning. Three of them leak a prior
account's state onto a reused device because they never reset to a clean state
for a new user, and `appEntry` is write-only (never read back). Net effect: a
returning multi-device user re-sees the full-screen onboarding modal, and a
brand-new account on a shared device can inherit "already onboarded" or "has a
password." All four defects share one root cause — **per-account state is not
treated as cloud-authoritative on identity change** — and one fix pattern.

## Findings covered

| id | sev | file:line | defect |
|---|---|---|---|
| hascompleted-phase-divergence | P1 | `src/lib/shared/onboarding/state/app-entry-state.svelte.ts:46` | `phase` seeded from `completed OR (firstRunDone AND !AUTO_TOURS_ENABLED)` while `hasCompleted` seeded from `completed` alone → they can disagree; an onboarded member with the app-entry key unset gets re-offered the tutorial. |
| app-entry-no-cloud-sync | P1 | `app-entry-state.svelte.ts:201`; wire at `src/lib/shared/auth/services/auth-boot-orchestrator.ts:85` | `syncFromCloud()` exists but is never called (siblings firstRun/generateTour/passwordOnboarding are wired at boot). Multi-device users get the modal on every new device. |
| app-entry-no-reset + raw-signout | P1 | `app-entry-state.svelte.ts:222`; `src/lib/shared/auth/services/account-manager.ts:179` | `syncFromCloud()` can only set `hasCompleted=true`, never reset → a stale `true` from a prior account sends a new account straight to "complete". `deleteAccount()` calls raw Firebase `signOut`, bypassing the app cleanup wrapper. |
| password-stale-haspassword | P1 | `src/lib/shared/onboarding/state/password-onboarding-state.svelte.ts:142` | Missing-doc branch intentionally does not touch `state.hasPassword`, so a passwordless magic-link account on a reused device inherits `true` and skips the non-skippable SetPasswordWizard. |

## Requirements

1. **Single source of truth for app-entry phase.** Derive `phase` purely from `hasCompleted` (one seed), so the two can never disagree. Preserve the shipped design matrix (AUTO_TOURS off → onboarded user lands on the app; not-yet-onboarded user can still be offered the guided build once).
2. **app-entry reads back from cloud at boot.** Add `await appEntryState.syncFromCloud()` alongside the three existing onboarding-state syncs in `auth-boot-orchestrator.ts`.
3. **Cloud is authoritative per account.** Every onboarding-state `syncFromCloud()` must handle the missing-doc case by **resetting to the clean default**, not leaving the prior device's value. Copy the reset-on-missing-doc branch `first-run-state.svelte.ts` already has. Applies to `appEntry` (reset `hasCompleted`/`phase`) and `passwordOnboarding` (reset `hasPassword`→false).
4. **Account deletion routes through the app cleanup path.** `deleteAccount()` calls `authState.signOut()` (the wrapper that clears onboarding state), not the raw SDK `signOut`.
5. **No re-interruption for onboarded users.** After the changes, an onboarded user opening the app on a second device sees no onboarding modal.

## Recommended approach

- Treat `first-run-state.svelte.ts` as the reference implementation for all four: it already resets on missing doc and is wired at boot. Bring `appEntry` and `passwordOnboarding` to parity.
- Gate the guided-build offer on a `cloudSynced` flag so the offer waits for the cloud read (avoids a flash of the modal before sync resolves, then dismiss).
- Do the phase-derivation refactor at the seed (`app-entry-state.svelte.ts:32-52`) so downstream `isComplete()`/`isCreateTutorial()` need no change.

## Open questions for Fable

- **cloudSynced gating.** Confirm the offer should suppress until the first cloud read resolves, and what the pre-sync default render is (nothing vs skeleton).
- **Consolidation.** Three onboarding docs with three hand-rolled sync layers is the deeper smell. Optional: unify them behind `onboarding-persister.ts` with shared versioning. Decide whether that is in-scope now or a follow-up (the four fixes above stand alone either way).

## Acceptance criteria

- [ ] `phase` is derived from `hasCompleted` only; the two cannot diverge (unit test: seed permutations).
- [ ] `appEntryState.syncFromCloud()` is called at auth boot next to the sibling syncs (grep proof).
- [ ] A missing `appEntry` doc resets `hasCompleted`→false (new account on reused device is NOT auto-completed).
- [ ] A missing `passwordOnboarding` doc resets `hasPassword`→false (magic-link account on reused device gets flagged `required`).
- [ ] `deleteAccount()` routes through `authState.signOut()` (grep proof; no raw `signOut` import in account-manager for this path).
- [ ] Onboarded user on a second device: no onboarding modal (runtime or state-driven test).
- [ ] `npm run check` clean.

## Verification

Unit-test the seed/sync permutations (completed×firstRunDone×missing-doc). Runtime: simulate a second device by clearing localStorage while signed in and confirm cloud read suppresses the modal. Evidence per `verification-protocol.md`.

## Out of scope

The onboarding analytics events (Spec 1). The full three-doc consolidation unless Fable pulls it in.
