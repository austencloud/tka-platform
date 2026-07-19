# Silent Work-Loss Elimination — Remediation Spec

**Date:** 2026-07-18
**Status:** Ready for Fable
**Severity:** P1 + P2
**Source:** 2026-07-18-onboarding-adversarial-audit.md (dimensions: guest-continuity, persistence-robustness)
**Design surface:** The per-sequence sync-status surfacing is a real UX design question (where/how it shows in the library). The other two are mechanical.

## Context

Cross-slice invariant #2 of the onboarding overhaul: **no silent loss anywhere —
any flow that could drop user work warns first and offers recovery.** Three paths
still violate it. One is a regression relative to its own sibling (the Spell tab
truncates silently while the Generate tab toasts the same cap), one shows the
user "Saved!" while the cloud copy may never have landed, and one can abort an
onboarding-completion write before its cloud sync on a storage quota error.

## Findings covered

| id | sev | file:line | defect |
|---|---|---|---|
| spell-truncation-silent | **P1** | `src/lib/features/create/generate/state/generate-actions.svelte.ts:439` | `onSpellGenerate()` slices past the beat cap with no toast; sibling `onGenerateClicked()` fires `toast.info("Capped to 8 beats…")`. Guest work silently drops. Same file, one loud path and one silent path. |
| firestore-sync-console-only | P1 | `src/lib/features/library/services/library-save-service.ts:306` | Background Firestore sync failure after a guest save is `console.warn`-only. User sees "Saved!"; repeated failure + device switch = silent loss. (ALREADY_EXISTS gets a toast; all other failures do not.) |
| onboarding-setitem-no-trycatch | P2 | `src/lib/shared/onboarding/state/first-run-state.svelte.ts:125` | `localStorage.setItem` has no try/catch; a `QuotaExceededError` (incognito/full) throws and aborts before the Firebase sync on the next line. `auth-state.svelte.ts:411-418` wraps its cache write; onboarding does not. |

## Requirements

1. **Spell-tab truncation is loud.** When `onSpellGenerate()` clips to the cap, fire the same tier-aware toast the Generate path uses, using `spellTier` for copy. Mirror `onGenerateClicked()` exactly.
2. **Save failures are visible and recoverable.** When the background Firestore sync fails (any error, not just ALREADY_EXISTS), the sequence's cloud-sync state is surfaced to the user — not swallowed. Retry on reconnect. The user must never believe a sequence is safely saved to the cloud when it is only in Dexie.
3. **Onboarding writes survive local-storage failure.** Wrap every onboarding `localStorage.setItem`/`removeItem` in try/catch and ensure the Firebase sync still fires even when the local write throws. Apply across the onboarding state files, not just first-run.

## Recommended approach

- Spell toast: literally copy the `onGenerateClicked` truncation block; swap `generateTier`→`spellTier`. Smallest fix, closes the regression.
- Sync status: add a per-sequence sync state (e.g. `synced | pending | failed`) tracked at save time and reflected in the library list; retry `pending`/`failed` on `online` / next app boot. This is the design-heavy piece — see open questions.
- localStorage guard: a tiny `safeSetLocalStorage` helper (or reuse the one `auth-state.svelte.ts` already implies) so the sync call is never skipped by a throw.

## Open questions for Fable

- **Sync-status surfacing.** Where does "not yet synced to cloud" show — a small badge on the library card, a per-item icon, a one-time toast on failure, or a passive retry with no UI until it repeatedly fails? Decide the least-alarming surface that still prevents the false "it's safe" belief. Brainstorm this one; it is the only real design decision in the spec.
- **Retry policy.** On reconnect only, or also on a timer / next boot? Bounded retries vs indefinite?

## Acceptance criteria

- [ ] Spell-generating a word past the cap shows a truncation toast (runtime or spy on `toast`).
- [ ] A forced Firestore sync failure surfaces a user-visible signal and the item is retried on reconnect (simulate offline, save, reconnect).
- [ ] A saved sequence's cloud-sync state is queryable/visible; the user is never shown an unqualified "Saved" when only Dexie succeeded.
- [ ] Onboarding completion still syncs to Firebase when `localStorage.setItem` throws (stub localStorage to throw; assert sync still called).
- [ ] `npm run check` clean.

## Verification

Spy on `toast` for the Spell path; DevTools offline/online for the sync path; stub `localStorage.setItem` to throw for the onboarding-write path. Evidence per `verification-protocol.md`.

## Out of scope

The R2 thumbnail path (already best-effort and correctly non-blocking). Analytics events for save (Spec 1).
