# First-Session Activation — Design

**Date:** 2026-07-22
**Status:** Design approved (Austen, 2026-07-22). Ready for implementation plan.
**Author:** Claude (Opus 4.8), with Austen

## Problem

Live user data (Firestore `users` + device/onboarding docs, 2026-07-22) shows two
measurable leaks in the first session:

**Leak A — new signups create nothing.** Every recent real signup lands and
bounces with zero content:
- Cheyenne Arana (@CheechChi) — Google signup 2026-07-22 10:31, iPhone Safari,
  single ~38s session, 0 sequences, no return.
- Theresa Jones / Major Motion (@Major_Motion) — Google signup via Facebook
  in-app browser on a Galaxy S25, first session ~44s, returned ~14h later, still
  0 sequences.
- John Cloud (@theprizman, tester) — logged in 2026-07-22 17:34 from Asheville
  NC on desktop Chrome; tester since Dec 2025, 0 sequences ever.

**Leak B — engaged guests are never asked to convert.** Anonymous @lsbqc7e4 ran
a 2h15m session on 2026-07-22, saved one sequence, and was never prompted to
create an account, because every existing conversion nudge is a reactive gate
(save cap, beat cap, export, publish) that a single-sequence session never trips.
That guest's work is on a 30-day deletion clock
(`cleanupStaleAnonymousAccounts.ts`) with nothing prompting them to keep it.

Both leaks are "the mechanism half-exists but doesn't convert," not missing
infrastructure. This spec closes the gap on existing seams.

## Goals

1. A first-timer reaches a **saved** sequence in one tap.
2. The moment a guest saves their first sequence, they get one soft, dismissable
   prompt to keep it with a free account.

## Non-goals (YAGNI)

- No new tour or coachmark system.
- No auto-seeded/pre-filled starter sequence (rejected in favor of one-click
  generate-and-keep).
- No time-based or action-count conversion triggers.
- No changes to `CreateTutorialWizard` internals; it stays as the
  build-it-yourself route.
- No premium/tier changes. No change to the default Create tab (Construct).

## What already exists (reuse, do not rebuild)

| Capability | Seam | Notes |
|---|---|---|
| One-click generate | `create/generate/components/cards/GenerateButtonCard.svelte:49-58` | `handleClick` → `uiConfigToGenerationOptions(config, PropType.FAN, startEndOptions)` → `onGenerateClicked(...)` callback. |
| First-run empty-Create seam | `create/shared/components/CreateModule.svelte:433-435` | Calls `appEntryState.offerCreateTutorial()` when `isWorkspaceEmpty()`. |
| Generator empty-state pattern | `create/generate/components/GenerateEmptyState.svelte` + `StandardWorkspaceLayout.svelte:224-226` | Mounted when `isGeneratorTab && !hasWorkspaceContent`. Generalize this, do not fork. |
| Library empty state (dead-end) | `shared/browse/components/BrowsePanel.svelte:258-268` (msg logic `:92-98`) | Today: "No sequences saved" + no create CTA. |
| Save boundary + guest cap | `features/library/services/library-save-service.ts:135-151` | Guest branch already computes `guestCount = db.sequences.count()`; `GUEST_SAVE_CAP = 3` (`auth/domain/guest-access-config.ts:10`). |
| Open auth with a reason | `auth/state/auth-drawer-state.svelte.ts:15` `authDrawerState.show(mode, reason)`; `openAuthDialog()` (used at save cap, `library-save-service.ts:143`) | `AuthModal.svelte:55-59` swaps its subtitle to `AUTH_NUDGE_TEXTS[reason]`. |
| Nudge copy registry | `auth/domain/auth-nudge-trigger.ts` (`AuthNudgeTrigger`, `AUTH_NUDGE_TEXTS`) | Add one key; modal picks up copy automatically. |
| In-place anon upgrade (preserves uid + all sequences) | `auth/services/anonymous-upgrade.ts` — `upgradeAnonymousWith{Google,Facebook,Email}`, `notifyUpgradeSignup()` fires `guest_upgraded_to_account` | No data migration needed on the happy path. |
| Funnel analytics | `analytics/services/onboarding-events.ts` (offered/accepted/declined/completed), `guest_upgraded_to_account` | Extend, don't replace. |
| First-run/onboarding state (local + cloud, missing-doc reset) | `onboarding/state/first-run-state.svelte.ts`, `onboarding/state/app-entry-state.svelte.ts`, boot in `auth/services/auth-boot-orchestrator.ts` | Pattern to follow for the new "starter dismissed" flag. |

## Design

### Part A — One-click first sequence

**Surface.** A first-run-only starter card on the empty Create workspace. Create
lands on Construct by default (`tab-definitions.ts:17 DEFAULT_CREATE_TAB`), which
today shows only the start-position picker with no call to action. The starter
renders in the empty-workspace slot (generalized from `GenerateEmptyState`), above
the picker, for first-timers only.

**Card.**
- Primary button **"Generate my first sequence"** → invokes the existing
  generation callback (`onGenerateClicked(uiConfigToGenerationOptions(config,
  PropType.FAN, startEndOptions))`) so the sequence renders in the **real shared
  workspace** (not the isolated `createTutorialState`). The existing
  Add-to-Library / Save affordance then reads "Save — it's yours."
- Secondary link **"I'll build my own"** → dismisses the starter and reveals the
  normal Construct start-picker. The guided `CreateTutorialWizard` remains
  reachable (its existing `offerCreateTutorial()`/Settings replay), unchanged.

**Gate — `shouldShowFirstSequenceStarter` (derived).** True only when all hold:
1. Create workspace is empty (`isWorkspaceEmpty()`, the `CreateModule.svelte:433`
   condition), and
2. the user has never saved a sequence (local library count 0), and
3. the starter has not been dismissed (new onboarding flag, below).

Fires for both guests and full accounts on their first empty landing. Not shown
once any sequence exists or the flag is set.

**Dismissal flag.** New `firstSequenceStarterState` following the existing
first-run/app-entry pattern: localStorage-first, cloud-authoritative under
`users/{uid}/onboarding/firstSequenceStarter`, reset-to-default on a missing doc
(so a shared browser never inherits a prior account's dismissal). Set on either
button. Synced at boot alongside the other onboarding docs in
`auth-boot-orchestrator.ts`.

**Library dead-end fix.** `BrowsePanel.svelte` empty state for
`engine.source === "my-library"` with 0 saved sequences gains a
**"Make your first sequence"** button that routes to Create and re-arms the
starter (clears the dismissal flag for this session so the CTA shows). Reuses the
design-system button primitive; no bespoke link (see `clickables-look-like-buttons`).

### Part B — Proactive "keep your work" on first save

**Hook.** The guest branch of `saveSequence` in
`library-save-service.ts:135-151` already establishes, for a non-full account,
`alreadySaved` and `guestCount`. This spec adds: capture
`isFirstGuestSave = !isFullAccount && !alreadySaved && guestCount === 0` before
the write, and after the save fully succeeds (end of `saveSequence`, after the
Dexie commit) fire the proactive prompt exactly once.

**Prompt.** Two-step, soft, per the play-first philosophy
(`project_guest_access_tier`):
- Step 1: inline nudge card (reuse the existing `AuthNudge` pattern used by the
  reactive gates) — headline copy plus **"Create account"** and **"Not now"**.
- Step 2 (on Create account): `authDrawerState.show("signup", "guest-first-save")`,
  which routes through the existing upgrade buttons
  (`SocialAuthCompact`/`EmailPasswordAuth` branch on `isAnonymous` →
  `upgradeAnonymousWith*`), preserving the uid and all saved sequences.

**Copy.** New `AuthNudgeTrigger` key `guest-first-save` in `auth-nudge-trigger.ts`:

> "You made something. Create a free account so it's still here tomorrow."

Ties to the real 30-day anonymous-deletion behavior. `AuthModal` shows it
automatically as its subtitle when opened with this reason.

**Once-only.** New `guestFirstSavePromptState` guard (localStorage; guests have no
cloud doc guarantee pre-conversion, and once they convert the prompt is moot), so
re-saves never re-nag. Cleared/ignored for full accounts.

### Data flow

```
First-timer lands on Create (Construct, empty)
  shouldShowFirstSequenceStarter == true
  → FirstSequenceStarter card
     ├─ "Generate my first sequence" → onGenerateClicked(...) → sequence in real workspace
     │     → user taps Save → saveSequence(...)
     │         guest + first save → (success) → guestFirstSavePrompt (step 1 card)
     │             → "Create account" → authDrawerState.show("signup","guest-first-save")
     │                 → upgradeAnonymousWith* → uid + sequences preserved, guest_upgraded_to_account
     └─ "I'll build my own" → dismiss (flag set) → Construct start-picker
```

## Files

**New (each single-purpose; grep confirmed no existing equivalent):**
- `onboarding/components/first-run/FirstSequenceStarter.svelte` — the CTA card.
  (Grep: no `firstSequence`/`starterSequence`/`seedSequence` component exists.)
- `onboarding/state/first-sequence-starter-state.svelte.ts` — dismissal flag,
  local + cloud, mirrors `first-run-state.svelte.ts`.
- `onboarding/state/guest-first-save-prompt-state.svelte.ts` — once-only guard.

**Changed:**
- `auth/domain/auth-nudge-trigger.ts` — add `guest-first-save` key + copy.
- `features/library/services/library-save-service.ts` — detect first guest save,
  fire the prompt post-success.
- `create/shared/components/CreateModule.svelte` (or the empty-state slot in
  `StandardWorkspaceLayout.svelte`) — mount `FirstSequenceStarter` under the
  `shouldShowFirstSequenceStarter` gate; wire the generate callback.
- `shared/browse/components/BrowsePanel.svelte` — add the "Make your first
  sequence" button to the empty my-library state.
- `auth/services/auth-boot-orchestrator.ts` — read/reset the new starter doc at
  boot.
- `analytics/services/onboarding-events.ts` — add `first_sequence_starter`
  (shown/generated/dismissed) and `guest_first_save_prompt` (shown/accepted/
  declined) events.

## Analytics

Reuse `onboarding-events.ts` and `guest_upgraded_to_account`. Add:
- `first_sequence_starter_shown` / `_generated` / `_dismissed` (source: create).
- `guest_first_save_prompt_shown` / `_accepted` / `_declined`.

These make the offered→generated and first-save→convert rates directly
measurable, which is the success metric (below), not a guess.

## Success metrics (post-ship, from PostHog)

- **Leak A:** share of new real signups that save ≥1 sequence in their first
  session rises from the current near-zero baseline.
- **Leak B:** `guest_first_save_prompt_shown` → `guest_upgraded_to_account`
  conversion is measurable and non-trivial.
- Guardrail: `first_sequence_starter_dismissed` rate and any drop in overall
  Create engagement (the starter must not annoy returning-feeling users — the
  gate prevents it, this confirms it).

## Rollout / flags

- Gate both behaviors behind a single flag in
  `onboarding/domain/onboarding-flags.ts` (e.g. `FIRST_SESSION_ACTIVATION_ENABLED`),
  mirroring `CREATE_TUTORIAL_ENABLED`, so it can ship dark and be enabled once
  verified.
- No firestore.rules change (the new onboarding doc is under the already-permitted
  `users/{uid}/onboarding/*` subtree).

## Testing

Unit (vitest):
- `shouldShowFirstSequenceStarter` is true only for empty workspace + zero saved +
  not dismissed; false once any of those flips.
- The generate path writes to the real workspace/current-sequence state, not the
  isolated `createTutorialState`.
- First-guest-save detection: fires the prompt exactly once, only when
  `!isFullAccount && !alreadySaved && guestCount === 0`; never for full accounts;
  never on the 2nd+ save.
- Contract: `guest-first-save` exists in `AUTH_NUDGE_TEXTS` and `AuthModal` renders
  its copy when opened with that reason (extends the existing 11-key trigger-map
  test).
- Dismissal flag round-trips local + cloud and resets on a missing doc.

Manual (record evidence per `verification-protocol`): first-run on a fresh
account shows the starter; generate → save → prompt appears once; "Not now"
dismisses and a 2nd save does not re-prompt; convert preserves the saved sequence.

## Open questions

None blocking. Default Create tab stays Construct (confirmed with Austen).

## Requirements ledger

- [ ] `FirstSequenceStarter.svelte` renders under the gate on empty first-run Create
- [ ] Primary button generates into the real workspace via the existing generate seam
- [ ] Secondary "build my own" dismisses to the Construct picker
- [ ] `shouldShowFirstSequenceStarter` gate (empty + never-saved + not-dismissed)
- [ ] `first-sequence-starter-state` dismissal flag (local + cloud + missing-doc reset + boot sync)
- [ ] Library empty-state "Make your first sequence" button
- [ ] `guest-first-save` nudge key + copy in `auth-nudge-trigger.ts`
- [ ] First-guest-save detection + once-only prompt in `library-save-service.ts`
- [ ] `guest-first-save-prompt-state` once-only guard
- [ ] Two-step prompt → `authDrawerState.show("signup","guest-first-save")` → existing upgrade path
- [ ] Analytics events wired
- [ ] `FIRST_SESSION_ACTIVATION_ENABLED` flag
- [ ] Unit tests (gate, real-workspace write, first-save-once, nudge-copy contract, flag round-trip)
- [ ] `npm run check` clean; manual verification evidence captured

## Related

- `project_onboarding_remediation` (the 2026-07-19 hardening this builds on)
- `project_guest_access_tier` (three-tier model, play-first nudge philosophy)
- `.claude/rules/never-hand-roll.md`, `primitive-discovery.md`,
  `no-layout-shift.md`, `clickables-look-like-buttons.md`, `no-checkboxes.md`
- `docs/superpowers/specs/active/2026-07-18-onboarding-remediation-index.md`
