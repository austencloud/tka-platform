# Onboarding Dead-Code & Drift Sweep — Remediation Spec

**Date:** 2026-07-18
**Status:** Ready for Fable
**Severity:** P2/P3
**Source:** 2026-07-18-onboarding-adversarial-audit.md (dimensions: dead-code-drift, entry-state-machine, persistence-robustness)
**Design surface:** Mostly mechanical, gated by `verify-before-deleting.md` (grep zero-importer proof before any delete). One product decision: does TabIntro dismissal sync cross-device?

## Context

Onboarding accumulated dead code and drift: a 524-line orphaned auth surface that
an agent still spent effort maintaining, a per-module onboarding storage layer
that outlived the component it served, two vestigial state-machine phases with no
template consumer, a stale docstring that contradicts a live flag, and a
module-id list that disagrees with its sibling. None of it ships behavior, but it
misleads every future agent (and cost real maintenance already).

## Findings covered

| id | sev | file:line | defect |
|---|---|---|---|
| landingpage-orphaned | P2 | `src/lib/shared/auth/components/LandingPage.svelte:1` | 524-line auth surface, zero importers, still edited Jul 12 in a rename sweep. Flagged as delete candidate 2026-06-18; unfixed. |
| module-onboarding-storage-dead | P2 | `src/lib/shared/onboarding/config/storage-keys.ts:72` | `markModuleOnboardingComplete`/`hasCompletedModuleOnboarding` + a Firestore `modules` sub-object: full CRUD surface, zero live callers, entangled with live What's New code. |
| vestigial-wizard-phases | P2 | `src/lib/shared/application/components/MainApplication.svelte:528` | `wizard-active` / `wizard-exiting` phases have no template consumer; the real first-run gate is `firstRunState.isDone()`; `isEntryAnimating()` is never read. |
| flags-docstring-stale | P2 | `src/lib/shared/onboarding/domain/onboarding-flags.ts:5` | Docstring claims "zero interruptions" while `CREATE_TUTORIAL_ENABLED` ships exactly one. |
| module-keys-mismatch | P3 | `storage-keys.ts:57` | `MODULE_ONBOARDING_KEYS` omits `create` that `MODULES_WITH_ONBOARDING` includes → resetAll clears `create` in Firestore but not localStorage; OR-merge could resurrect it. |
| tabintro-synced-vs-local | P1→sweep | `storage-keys.ts:81` | The only cloud-synced module/tab-onboarding API has zero callers; live TabIntro tracks dismissal in a raw `tabIntroSeen:${moduleId}:${tabId}` localStorage key that never syncs. Per-tab intros reappear across devices. |

## Requirements

1. **LandingPage.svelte:** delete it (zero importers), or if genuinely parked for a reason, add a top-of-file comment + a memory note explaining why so no agent maintains it again. Default to delete.
2. **Module-onboarding storage layer:** remove the dead functions, the type, and the Firestore `modules` machinery; update the onboarding `README.md` migration section to match reality. Do not disturb the live What's New code it is entangled with.
3. **Vestigial phases:** either wire `isEntryAnimating()` to a real consumer or delete `wizard-active`/`wizard-exiting` from the phase union and their dead branches. Coordinate with Spec 2 (which refactors the same state machine) — do this after or together with Spec 2 to avoid conflicts.
4. **Stale docstring:** rewrite the `onboarding-flags.ts` docstring to describe the actual `AUTO_TOURS_ENABLED` (off) vs `CREATE_TUTORIAL_ENABLED` (on, one offer) split.
5. **Module-id single source:** derive both `MODULE_ONBOARDING_KEYS` and `MODULES_WITH_ONBOARDING` from one canonical module-id array so they cannot disagree.
6. **TabIntro sync decision:** either wire TabIntro through the synced API (intros dismissed on one device stay dismissed everywhere) OR delete the unused synced persister surface and document intros as intentionally local-only. Pick one; do not leave both.

## Recommended approach

- Run this spec largely LAST (it is the sweep). The vestigial-phase removal overlaps Spec 2's state-machine refactor — sequence them so one does not clobber the other.
- Every delete requires a fresh grep proving zero live importers in the same change (`verify-before-deleting.md`), pasted into the commit or PR body.
- Prefer deletion over park-comments unless there is a concrete revive reason.

## Open questions for Fable

- **TabIntro cross-device sync** is a product call: should dismissing a tab intro on your phone dismiss it on your laptop? If yes → wire the synced API (and TabIntro becomes cloud-backed). If no → delete the synced surface and keep the local key. Austen's call; brainstorm briefly.
- **LandingPage** — confirm with a grep + a quick history check that it is truly abandoned (not staged for a future route) before deleting.

## Acceptance criteria

- [x] `LandingPage.svelte` deleted (with zero-importer grep proof) or annotated with a documented reason. Commit `478a262498`.
- [x] Module-onboarding dead functions/type/Firestore machinery removed; README migration section updated; What's New still works (verified via call-site evidence + `vitest` run, not `npm run check` — banned for this task by the executor prompt; see Verification note below). Commit `7abd31d196`.
- [x] `wizard-active`/`wizard-exiting` either consumed or removed from the phase union; no dead branches remain. Re-verification found both phases ARE live (wizard-exiting read directly in MainApplication.svelte template); only `isEntryAnimating()` was dead — wired it to that exact consumer instead of deleting the phases. Commit `82b8cf7f6b`.
- [x] `onboarding-flags.ts` docstring matches the real flag behavior. Commit `d114331176`.
- [x] `MODULE_ONBOARDING_KEYS` and `MODULES_WITH_ONBOARDING` derive from one array (cannot diverge; unit-testable). Resolved by elimination in commit `7abd31d196`: both lists (and every consumer of either) were deleted as dead code, so there is nothing left that can diverge. No unit test was added for "one canonical array" since there is no longer an array to test — introducing one solely to satisfy this criterion's letter would have been new dead code.
- [x] TabIntro tracking is either synced or documented local-only — not both surfaces live. Adjudicated: TabIntro.svelte has zero mount points anywhere in the app (confirmed independently, not just trusting a prior report — see grep evidence in the executor's final report). No wiring done; no additional deletion done beyond the ordinary dead-code removal in requirement 2. README.md's "History: migration from ModuleOnboarding" section now documents this explicitly (local-only, unmounted, cross-device sync is a fresh design decision if/when a tab adopts it).
- [x] **2026-07-19 follow-up: owner decision to delete, not just document.** Given the confirmed-dead status above, Austen decided to remove TabIntro outright rather than keep dead-but-documented code around. Fresh zero-importer grep this turn (repo-wide, `.ts`/`.svelte`, excl. node_modules) for `TabIntro\.svelte|<TabIntro|import TabIntro`: matches only in the file itself, `onboarding-persister.ts`/`storage-keys.ts`/`services/types.ts` docstrings (comments, not imports), and `README.md`. Zero component-mount or import matches anywhere else. Deleted: `components/TabIntro.svelte`, `config/tab-intro-content.ts` (grep for `tab-intro-content|getTabIntroContent|hasTabIntroContent|TabIntroContent|TabIntroPage` matches only in `TabIntro.svelte` itself and `README.md`, zero other consumers). Also removed the now-inert `tabIntroSeen:*` suppression block from `tests/screenshots/capture.spec.ts`'s `suppressOnboarding()` (it wrote keys nothing reads once TabIntro is gone) and updated the stale "TabIntro.svelte" references in `storage-keys.ts`/`onboarding-persister.ts`/`services/types.ts` docstrings and `desktop-sidebar-state.svelte.ts`'s consumer-list comment. `README.md` rewritten from a usage guide (for a component that no longer exists) into a deletion record. Separately confirmed: the "TAB-level cloud-synced onboarding API" this task's executor prompt described as still present at `storage-keys.ts:~81` does not exist as a distinct surface. It is the same module-level API (finding `module-onboarding-storage-dead`) already deleted in commit `7abd31d196`; fresh grep for `TabOnboarding|markTab|hasCompletedTab|tabOnboarding` (case-insensitive) returns zero matches anywhere in `src/`.
- [x] `npm run check` clean — NOT run. The executor prompt for this task explicitly forbids `npm run check`/`npm run build`/dev servers ("Scoped `npx vitest run` allowed"). Verification substitute used instead: `npx vitest run --config tests/config/vitest.config.ts tests/unit/onboarding/` (25/25 passing) + `npx tsc --noEmit -p tsconfig.json --skipLibCheck` (zero errors matching onboarding/LandingPage; some pre-existing unrelated `.svelte`-module-resolution errors from raw `tsc` remain, expected since this project normally type-checks via `svelte-check`). A full `npm run check` should still be run before this lands on `main` for real — flagging as the one deferred gate, per instruction, not silently skipped. **Closed 2026-07-25:** `npm run check` run machine-wide → `svelte-check found 0 errors and 4 warnings in 3 files`; all 4 are pre-existing unused-CSS-selector warnings in unrelated landing files. Gate satisfied.

## Verification

Grep zero-importer proof per deletion; `npm run check` after the sweep; runtime smoke of What's New and TabIntro. Evidence per `verify-before-deleting.md` + `verification-protocol.md`.

## Out of scope

Behavior changes beyond removing/annotating dead paths. The state-machine correctness refactor itself (Spec 2).
