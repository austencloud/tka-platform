# Onboarding Adversarial Audit

Best-practices review of the Flow Arts Composer onboarding, synthesized from ten
dimension audits with per-finding adversarial verification.

**Method (2026-07-18):** 10 parallel dimension finders (Sonnet, high effort) read
the real onboarding + auth code and 2026 best practices; every finding was then
handed to an independent adversarial verifier told to refute it against source.
44 raw findings, **41 survived**, 3 refuted/dropped. 55 agents, 0 errors.

> Correction applied post-synthesis: the "landing has no sign-in link" claim
> (carried from the month-old audit) was **REFUTED** on recheck. The sign-in
> entry lives in `src/routes/+layout.svelte` (root chrome), not the
> `landing/*.svelte` components the earlier grep scoped. Treated as resolved
> below, not "still broken."

## Verdict

The core funnel is sound: a cold guest reaches first value in about three taps,
gating correctly sits at export/beat-cap rather than at play, guest work now
provisions identity and carries across signup with confirmation, and two
prior-audit P1s (post-signup confirmation, cross-tab guest identity) are
genuinely fixed. The single biggest risk is analytics: the entire post-signup
onboarding funnel emits zero named events, and `user_signed_up` fires only for
QR-scan traffic, so the team cannot measure signups-per-day or any
wizard/tutorial drop-off at all. Close behind are three account-scoped state
leaks (app-entry, password, plus raw-SDK signOut on delete) that let a reused
device inherit a prior account's completed-onboarding and has-password flags,
and an accessibility gap where five hand-rolled overlays never trap focus or
expose dialog semantics despite two in-repo primitives that do it correctly.
None of these breaks the happy path, but several silently degrade returning-user
and multi-device experience. Fix the instrumentation and the state-scoping leaks
first; the rest is polish.

## Best-Practice Scorecard

| Dimension | Grade | Why |
|---|---|---|
| entry-state-machine | C | Two persistence keys can disagree and re-pop the tutorial for onboarded members; cross-device sync is write-only. |
| guest-continuity | B- | Materially improved (identity + confirmation fixed), but Spell-tab truncation is still silent and sync failures stay console-only. |
| accessibility | D | Five overlays never trap focus or make the app inert; two lack any dialog role; no step-change announcements. |
| persistence-robustness | C- | State fragmented across three docs; the only cloud-synced tab API has zero callers; completion writes are unguarded. |
| activation-funnel-ux | B- | Short time-to-value and opt-in guided build, but app-entry never reads back from cloud. |
| analytics-instrumentation | F | Onboarding funnel emits zero events; signup event gated on scan attribution; `save` is a debounced autosave. |
| copy-messaging | C | Tutorial copy is clean, but the nudge layer has four phrasings, dead copy strings, and an unexplained export gate. |
| dead-code-drift | C+ | `LandingPage.svelte` orphaned yet still edited; module-onboarding storage layer outlived its deleted component. |
| layout-stability | B+ | Disciplined where it counts; only latent P3 reflow risks and one hand-rolled crossfade. |
| auth-security | C | Public surfaces correctly gated except anon collection publish; three account-scoped flag leaks. |

## P0 - fix now

- **user_signed_up only captured for QR-scan-attributed signups** - the event is nested inside `if (scanCode)`, so direct and organic signups never fire it; there is no unconditional capture anywhere (`src/lib/shared/auth/state/auth-state.svelte.ts:532`). The team cannot query signups-per-day from events. Fix: hoist `captureEvent("user_signed_up", { scan_source_code: scanCode ?? null })` outside the `if (scanCode)` check; keep attribution as an optional property.

## P1 - high value

- **Entire app-entry/tutorial state machine has zero analytics events** - none of the five phase transitions (offered, accepted, declined, complete, wizard complete) call captureEvent/logActivity; grep across all 26 onboarding files returns zero matches (`src/lib/shared/onboarding/state/app-entry-state.svelte.ts:128`). Fix: add events at offerCreateTutorial, acceptTutorial, declineTutorial, and completeEntry with a source/phase property.

- **hasCompleted/phase divergence re-pops the tutorial for onboarded returning members** - `phase` is seeded from `completed OR (firstRunDone AND !AUTO_TOURS_ENABLED)` while `hasCompleted` is seeded from `completed` alone, so a user with first-run done but the app-entry key unset gets the offer again (`src/lib/shared/onboarding/state/app-entry-state.svelte.ts:46`), contradicting the shipped design matrix. Fix: derive `phase` purely from `hasCompleted` so there is one source of truth.

- **appEntryState.syncFromCloud() never called; app-entry never reads back from cloud** - completion is written to Firestore but nothing pulls it down, unlike the wired sibling `firstRunState` (`src/lib/shared/onboarding/state/app-entry-state.svelte.ts:201`; missing call at `src/lib/shared/auth/services/auth-boot-orchestrator.ts:85`). A returning multi-device user gets the full-screen modal on every new device. Fix: add `await appEntryState.syncFromCloud()` alongside the other three onboarding-state syncs and gate the offer on a cloudSynced flag.

- **app-entry-state never resets stale flags for a new user; account deletion skips app cleanup** - `syncFromCloud()` can only set `hasCompleted` true, never reset, so a stale `true` from a prior account sends a brand-new account straight to phase "complete"; `deleteAccount()` calls raw Firebase `signOut` bypassing the app's cleanup wrapper (`src/lib/shared/onboarding/state/app-entry-state.svelte.ts:222`; `src/lib/shared/auth/services/account-manager.ts:179`). Fix: add the reset-on-missing-doc branch first-run-state already has, and route deletion through `authState.signOut()`.

- **password-onboarding-state leaves stale hasPassword=true for a new account** - the missing-doc branch intentionally does not touch `state.hasPassword`, so a passwordless magic-link account on a reused device inherits `true` and never gets flagged `required`, bypassing the non-skippable SetPasswordWizard (`src/lib/shared/onboarding/state/password-onboarding-state.svelte.ts:142`). Fix: reset `hasPassword` to false on missing doc, treating the cloud as authoritative per-account.

- **Anonymous guests can publish public collections** - the `users/{userId}/collections` isPublic write path uses isAuthenticated()-based isOwner() while every sibling public surface requires isFullUser() (`firestore.rules:531`). Guest content reaches the world-readable community feed. Fix: require isFullUser() when the write sets or the resource has `isPublic == true`, and add the client-side check in CollectionCard/collections-state.

- **Five hand-rolled overlays never trap focus or make the live app inert** - `<MainInterface />` stays mounted and reachable behind CreateTutorialWizard/TutorialPrompt/AccountSetupWizard, none of which use the in-repo `FocusTrap` or `BaseModal` (`src/lib/shared/application/components/MainApplication.svelte:506`). Tabbing leaks into the app behind the modal. Fix: route all five overlays through `FocusTrap` or `BaseModal`, matching GeneratePanelTour.

- **CreateTutorialWizard and AccountSetupWizard render with zero dialog semantics** - no `role`, `aria-modal`, `aria-labelledby`, or focus-on-mount, despite sibling `TutorialPrompt.svelte:62-66` doing all three (`src/lib/shared/onboarding/components/create-tutorial/CreateTutorialWizard.svelte:143`). AT users may never discover the overlay exists. Fix: add dialog role/aria-modal/label and move focus in on mount.

- **Multi-step tour content swaps with no aria-live and no focus move** - CreateTutorialWizard, GeneratePanelTour, and StepEditorTour all advance steps with no announcement (`src/lib/shared/onboarding/components/create-tutorial/CreateTutorialWizard.svelte:168`). Screen reader users hear nothing on advance. Fix: wrap step content in `aria-live="polite"` or move focus to the new step's heading.

- **The only cloud-synced module/tab-onboarding API has zero callers; live TabIntro uses an unsynced key** - `markModuleOnboardingComplete`/`hasCompletedModuleOnboarding` are dead while TabIntro tracks dismissal in a raw `tabIntroSeen:${moduleId}:${tabId}` localStorage key that never touches Firestore (`src/lib/shared/onboarding/config/storage-keys.ts:81`). Per-tab intros reappear across devices. Fix: wire TabIntro through the synced API, or delete the unused persister surface and accept intros as local-only.

- **Spell-tab beat-cap truncation is silent** - `onSpellGenerate()` slices past the cap with no toast, unlike the sibling `onGenerateClicked()` which fires `toast.info("Capped to 8 beats...")` (`src/lib/features/create/generate/state/generate-actions.svelte.ts:439`). Guest work silently drops. Fix: mirror the onGenerateClicked toast using spellTier for copy.

- **Background Firestore sync failure after a guest save is console-only** - user sees "Saved!" while the cloud copy never landed; a repeated failure plus device switch means silent loss (`src/lib/features/library/services/library-save-service.ts:306`). Fix: track per-sequence sync status surfaced in the library list and retry on reconnect.

- **Export gate shows a generic modal with no explanation; its dedicated copy is dead** - `ensureFullAccountForExport()` opens a signup modal whose subtitle talks about saving, not exporting, while `auth-nudge-trigger.ts:16`'s `export` string has zero call sites (`src/lib/shared/auth/domain/export-gate.ts:18`). Fix: wire the export gate through `<AuthNudge trigger="export">` or pass a reason into `authDrawerState.show`.

- **AuthNudge uses four incompatible phrasings for the same "create an account" ask** - body copy varies between "Create a free account", "Sign up free", and the button's "Create Account - free" (`src/lib/shared/auth/domain/auth-nudge-trigger.ts:12`); this is the 2026-06-18 finding still unfixed. Fix: collapse to one verb plus one modifier across all nine entries and the button.

- **sequence_save fires on every debounced autosave, not an explicit save** - `saveSequenceDataOnly()` runs from a 500ms autosave on every beat edit, so "first save" cannot be a discrete milestone (`src/lib/features/create/shared/state/sequence-state-orchestrator.svelte.ts:342`). Fix: rename the autosave capture to `sequence_autosaved` and add a distinct explicit-save event.

## P2/P3 - polish

- **Cold-start Create offer is a blocking modal while Generate avoids modals for the same moment** - `TutorialPrompt` is a full-screen fixed backdrop, contradicting `GenerateEmptyState`'s commented "zero modal interruptions" stance (`src/lib/shared/onboarding/components/create-tutorial/TutorialPrompt.svelte:89`). Fix: route the offer through the inline empty-state pattern, or document the exemption. (P2)

- **onboarding-flags docstring claims "zero interruptions" while CREATE_TUTORIAL_ENABLED ships one** - stale comment directly precedes the flag that breaks it (`src/lib/shared/onboarding/domain/onboarding-flags.ts:5`). Fix: update the docstring to describe the actual AUTO_TOURS vs CREATE_TUTORIAL split. (P2)

- **TutorialPrompt accept/skip handlers fire no event** - only haptics and the parent callback, so accept-vs-decline rate is not queryable (`src/lib/shared/onboarding/components/create-tutorial/TutorialPrompt.svelte:38`). Fix: fire `tutorial_prompt_accepted`/`declined` before the callbacks. (P2)

- **"wizard-active" and "wizard-exiting" phases have no template consumer** - the real first-run gate is the independent `firstRunState.isDone()`; `isEntryAnimating()` is never read (`src/lib/shared/application/components/MainApplication.svelte:528`). Fix: wire `isEntryAnimating` or delete the two vestigial phases. (P2)

- **Onboarding completion writes call localStorage.setItem with no try/catch** - a thrown QuotaExceededError aborts the write before the Firebase sync on the next line, unlike `auth-state.svelte.ts:411-418` which wraps its cache write (`src/lib/shared/onboarding/state/first-run-state.svelte.ts:125`). Fix: wrap every onboarding setItem/removeItem and ensure the sync still fires on local failure. (P2)

- **generate action never fires as an analytics event** - `logSequenceAction("generate")` is in the type union with zero call sites, so the AI-generation activation path is invisible (`src/lib/shared/analytics/services/posthog-activity-logger.ts:80`). Fix: call it from the generate-panel success path. (P2)

- **identifyUser fires for anonymous guests with no upgrade event** - guest-to-account conversion cannot be isolated from a new anonymous session (`src/lib/shared/auth/state/auth-state.svelte.ts:519`). Fix: emit `guest_upgraded_to_account` unconditionally at linkWithCredential completion. (P2)

- **4 of 9 centralized nudge strings are dead code and the real gate hand-rolls different copy** - `save`/`export`/`generate-cap`/`edit-community` have zero call sites while the save-cap fires its own toast at `library-save-service.ts:139` (`src/lib/shared/auth/domain/auth-nudge-trigger.ts:13`). Fix: wire the strings to real sites or delete the unused variants. (P2)

- **LandingPage.svelte is fully orphaned yet still edited** - 524-line auth surface with zero importers, touched Jul 12 in a rename sweep (`src/lib/shared/auth/components/LandingPage.svelte:1`). Fix: delete it, or add a comment/memory note explaining why it is parked. (P2)

- **Per-module onboarding storage layer outlived its deleted component** - full CRUD surface plus a Firestore `modules` sub-object with zero live callers, entangled with live What's New code (`src/lib/shared/onboarding/config/storage-keys.ts:72`). Fix: remove the dead functions/type/machinery and update the README migration section. (P2)

- **Legacy root /sequences and /collections rules allow any authenticated write** - anon-writable and `/sequences` is world-readable with no isPublic gate; no app call sites but rules are enforced against the raw SDK (`firestore.rules:560`). Fix: delete the blocks or tighten to isFullUser(). (P2)

- **StepEditorTour declares role=dialog but omits aria-modal and a per-stop label** - accessible name is announced once and never surfaces the changing stop title (`src/lib/shared/onboarding/components/step-editor-tour/StepEditorTour.svelte:85`). Fix: add aria-modal and update aria-labelledby to the current stop. (P2)

- **CreateTutorialWizard Back/Skip controls skip the --min-touch-target token** - ~30-36px effective height vs the codebase's 48px floor used elsewhere (`src/lib/shared/onboarding/components/create-tutorial/CreateTutorialWizard.svelte:244`). Fix: apply `min-height: var(--min-touch-target)`. (P2)

- **TabIntro pagination dots are 8x8px with no hit-area padding** - the only equivalent control steps forward one page at a time, so the SC 2.5.8 exception is unclear (`src/lib/shared/onboarding/components/TabIntro.svelte:219`). Fix: expand the hit area to >=24px via padding or a transparent pseudo-element. (P2)

- **TabIntro directive transitions bypass prefers-reduced-motion** - the file's CSS media block cannot cancel Svelte `transition:` directives, unlike the two components that check matchMedia in JS (`src/lib/shared/onboarding/components/TabIntro.svelte:160`). Fix: compute prefersReducedMotion in script and gate the transition params. (P3)

- **TabIntro multi-page pagination has no reserved space for variable-length bullets** - latent reflow that fires the moment a second page with a different point count ships; every config is single-page today (`src/lib/shared/onboarding/components/TabIntro.svelte:186`). Fix: reserve the tallest page's height or route through `<Crossfade fill>`. (P3)

- **CreateTutorialWizard hand-rolls the shared Crossfade swap behavior** - a manual timeout-driven fade plus a duplicated reduced-motion check; no import or carve-out comment (`src/lib/shared/onboarding/components/create-tutorial/CreateTutorialWizard.svelte:70`). Verify note: PLAUSIBLE, not exact - Crossfade `mode="swap"` is a pure opacity fade on a keyed remount, close but not identical. Fix: use `<Crossfade mode="swap">` or add a justification comment. (P3)

- **MODULE_ONBOARDING_KEYS omits 'create' that MODULES_WITH_ONBOARDING includes** - resetAll clears create in Firestore but not localStorage, and the OR-merge could resurrect it (`src/lib/shared/onboarding/config/storage-keys.ts:57`). Fix: derive both from one canonical module-id array. (P3)

- **loop-locked-guest nudge drops undefined TKA jargon at the persuasion moment** - "Rotated LOOPs" and "LOOP type" with zero gloss to a first-time guest (`src/lib/shared/auth/domain/auth-nudge-trigger.ts:24`). Fix: add a one-clause gloss or fire the nudge only after a LOOP explanation. (P3)

- **Email-link sign-in auto-completes on load with no confirm step** - the single-use oobCode is consumed by corporate link-prescanners before the human clicks, and the wrong-device fallback uses `window.prompt` (`src/lib/shared/auth/state/auth-state.svelte.ts:347`). Fix: add a "Finish signing in" interstitial and replace the prompt with an in-page email field. (P3)

- **StepEditorTour.triggerIfFirstTime() is a flagged-off no-op** - intentional dormancy per code comment while AUTO_TOURS_ENABLED is false; manual restart stays live (`src/lib/features/create/shared/components/sequence-actions/StepEditorPanel.svelte:179`). No action now; revisit when the flag flips. (P3)

## What the prior audits got right / what regressed

Genuinely fixed since 2026-06-18:
- **Cross-tab guest-identity gap closed** - `ensureGuestIdentity()` now runs unconditionally at the save boundary (`src/lib/features/library/services/library-save-service.ts:80`), backstopping Generate/Spell/import, not just Construct.
- **Post-signup confirmation added** - `notifyUpgradeSignup()` fires `toast.success("Account created. Your sequences are saved.")` on the ~90% no-collision path (`src/lib/shared/auth/services/anonymous-upgrade.ts:104`), with a distinct import toast on the collision path.
- **Landing sign-in link** - REFUTED as a live defect. The entry exists in `src/routes/+layout.svelte` (root chrome); the month-old finding grepped only the landing components. Verify low-visibility if worried, but the link is present.

Still true / partially fixed:
- **Spell-tab truncation regressed relative to its sibling** - the beat-cap toast landed in `onGenerateClicked` but never in `onSpellGenerate`, so the same file now has one silent and one loud path.
- **AuthNudge copy fragmentation** - flagged 2026-06-18, confirmed unfixed (`auth-nudge-trigger.ts:12`).
- **LandingPage orphaned** - flagged as a delete candidate 2026-06-18, still orphaned and since edited by a rename sweep.
- **Firestore sync failures console-only** - carried over from the prior audit, never revisited.

New ground (no prior claim to reconcile): accessibility, layout stability, and analytics instrumentation were not covered by the month-old audits.

## Recommended sequence

1. Fix signup and onboarding instrumentation (P0 + onboarding-zero-events + tutorial-prompt-handlers-silent) so every later change is measurable.
2. Close the three account-scoped state leaks (app-entry reset, password reset, raw-SDK signOut on delete) and wire `appEntryState.syncFromCloud()` into auth boot; these share the same root cause and fix pattern.
3. Close the anon collection publish path in `firestore.rules` and the client gate.
4. Fix the entry-state divergence at the source by deriving `phase` from `hasCompleted`.
5. Route the five overlays through `FocusTrap`/`BaseModal` and add dialog roles plus step-change announcements.
6. Land the two silent-loss fixes (Spell-tab toast, wrapped localStorage writes) and the export-gate copy wiring.
7. Sweep the dead code (LandingPage, module-onboarding storage, dead nudge strings, legacy root rules) and reconcile TabIntro's synced-vs-local tracking.
8. Polish remaining P2/P3 touch targets, reduced-motion, latent reflow, and the hand-rolled crossfade.
