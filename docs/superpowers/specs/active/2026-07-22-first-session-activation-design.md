# First-Session Activation — Design

**Date:** 2026-07-22
**Status:** Revision 2 — reconciled against code review (2026-07-22). Awaiting
re-review before implementation plan.
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

**Leak B — engaged guests are asked to convert only with a passive toast.**
Anonymous @lsbqc7e4 ran a 2h15m session on 2026-07-22, saved one sequence. There
IS a post-save nudge (`maybeNudgeGuestToSignUp`, `library-save-service.ts:258`),
but it is a fire-and-forget `toast.info` with **no signup control, no
instrumentation, once-per-device**, and it lives only inside `LibrarySaveService`
— so the two save paths that bypass that service (viewer save, printed-card
import) never fire it at all. A guest reads "create a free account" with nothing
to tap. Their work is on a 30-day-inactivity deletion clock
(`cleanupStaleAnonymousAccounts.ts`).

Both leaks are "the mechanism half-exists but doesn't convert," not missing
infrastructure. This spec upgrades existing seams.

## Review reconciliation (what Revision 1 got wrong)

Revision 1 was reviewed and sent back. The load-bearing corrections, each
verified against code this pass:

1. **Generation seam.** Rev 1 said the starter would call
   `GenerateButtonCard`'s `onGenerateClicked`. That callback is a **local closure
   built inside the lazy-mounted `GeneratePanel`** (`GeneratePanel.svelte:68-76`),
   only mounted when the Generate tab is active
   (`CreationToolPanelSlot.svelte:156-165`), targeting the **isolated generator-tab
   `SequenceState`** (`create-module-state.svelte.ts:100-123`, "prevents cross-tab
   data pollution"), and it **returns `void`, swallowing failures** into
   `generationError` (`generate-actions.svelte.ts:73-99`). The correct seam is the
   service beneath the button: `getGenerationOrchestrator().generateSequence(options)`
   (`get-generation-orchestrator.ts:11`), which **returns the `SequenceData`**
   (`generate-actions.svelte.ts:405`) and is already used headlessly by landing
   (`infinite-sequence-generator.ts`, `endless-spinner-orchestrator.ts`).
2. **"Saved in one tap" was not real.** Save is generate → tap the save icon
   (`SaveToLibraryButton.svelte`) → confirm in `SaveToLibraryPanel.svelte`. Part A
   now runs a single **generate-then-persist command** so "keep" is truthful, with
   named failure behavior.
3. **Leak B already has an implementation** (`maybeNudgeGuestToSignUp`,
   `library-save-service.ts:258-275`). Part B **replaces that toast**, it does not
   add a parallel nudge (never-hand-roll).
4. **`guestCount === 0` is device-wide, not guest-scoped** — it misses existing
   guests (including the motivating guest, who already has 1 save). The trigger is
   re-scoped to the guest UID and to a **confirmed local persist**.
5. **The eligibility gate cannot key on a global Dexie count.** The browse engine
   is explicit: guests read Dexie, **full accounts must NOT read Dexie**
   (not uid-scoped, `create-browse-engine.svelte.ts:467-474`). The gate uses
   account-aware resolved library state, with an explicit "unknown until resolved"
   state so nothing flashes.
6. **The empty-Create tutorial already fires** (`offerCreateTutorial()`,
   `CreateModule.svelte:433-435`). The starter must arbitrate with it.
7. **A service cannot render `AuthNudge`** (`AuthNudge.svelte` is presentational:
   `onCreateAccount`/`onLogin`/`onDismiss` props, three actions). The prompt is
   hosted by a **root-owned coordinator** that mounts after the save surface closes
   (`save-panel-state.svelte.ts:259`), off a returned save outcome.
8. **`BrowsePanel`'s empty state is shared** by pickers and sheets and only
   distinguishes filter-zero from empty by icon (`BrowsePanel.svelte:258-268`).
   The "make your first sequence" CTA goes in the library-view host, not the shared
   empty state.
9. **Preservation is only guaranteed on the anon-link path.** One Tap, cross-browser
   email link, and credential-collision routes bypass `anonymous-upgrade`. Part B's
   CTA routes through `upgradeAnonymousWith*`; the non-link routes get an explicit
   fallback (below), not a silent "preserved" promise.

## Goals

1. A first-timer reaches a **generated, kept** sequence in one tap (one command:
   generate into the real workspace, then persist).
2. The moment a guest saves their first sequence — through **any** save path — they
   get one soft, dismissable, instrumented prompt with a real signup control.

## Non-goals (YAGNI)

- No new tour or coachmark system.
- No auto-seeded/pre-filled starter sequence (the one tap generates a real one).
- No time-based or action-count conversion triggers.
- No changes to `CreateTutorialWizard` internals; it stays the build-it-yourself
  route, reachable from Settings replay.
- No premium/tier changes. No change to the default Create tab (Construct).
- No mutation of the `AuthNudge` primitive (its Log-in action stays; we instrument
  it, we don't remove it).

## What already exists (reuse / upgrade, do not rebuild)

| Capability | Seam | Notes |
|---|---|---|
| Headless generation | `create/generate/shared/get-generation-orchestrator.ts:11` → `GenerationOrchestrator.generateSequence(options)` | Returns the `SequenceData` (`generate-actions.svelte.ts:405`). Already used headlessly by landing. **This is Part A's generate seam.** |
| Options builder | `uiConfigToGenerationOptions(config, prop, startEndOptions)` (used in `GenerateButtonCard`/`generate-actions`) | Build a smooth default config; no UI needed. |
| Save orchestration + guest cap | `features/library/services/library-save-service.ts` | `GUEST_SAVE_CAP=3`; guest branch at `:135-151`; **existing post-save nudge at `:258-275` (the thing Part B replaces)**; Dexie failure already surfaces a user error at `:182-200` (does not silently swallow, but also does not rethrow). |
| First-run empty-Create seam + tutorial offer | `create/shared/components/CreateModule.svelte:433-435` | `offerCreateTutorial()` on empty workspace — the call the starter must arbitrate with. |
| Generator empty-state pattern | `create/generate/components/GenerateEmptyState.svelte` | Layout precedent for the starter card. Generalize, do not fork behavior. |
| Nudge primitive | `auth/components/AuthNudge.svelte` | Presentational; `onCreateAccount`/`onLogin`/`onDismiss`. Rendered by a host, never by a service. |
| Nudge copy registry | `auth/domain/auth-nudge-trigger.ts` (`AUTH_NUDGE_TEXTS`, 11 keys, one-phrasing rule) | Add one key following the "Create a free account to <do X>" phrasing. |
| Open auth with a reason | `authDrawerState.show(mode, reason)`; `openAuthDialog()` | `AuthModal` swaps subtitle to `AUTH_NUDGE_TEXTS[reason]`. |
| In-place anon upgrade (preserves uid + sequences) | `auth/services/anonymous-upgrade.ts` — `upgradeAnonymousWith{Google,Facebook,Email}`, `notifyUpgradeSignup()` → `guest_upgraded_to_account` | **Only** this path preserves without import; One Tap / cross-browser link / collision do not (Finding 9). |
| Account-aware library read | `authState.isFullAccount`; browse engine's guest=Dexie / full=Firestore split (`create-browse-engine.svelte.ts:467-474`) | The gate's "has the user saved anything" must follow this split. |

## Design

### Part A — One-tap first sequence (generate-then-keep)

**Surface.** A first-run-only starter card in the empty Create workspace. Create
lands on Construct (`DEFAULT_CREATE_TAB`), which shows only the start-position
picker. The starter renders in the empty-workspace slot for first-timers only, and
**replaces** the Construct picker until resolved (dismiss reveals the picker).

**The generate-then-keep command (new, headless).** A single
`startFirstSequence()` action, dynamically imported, that:
1. Builds a smooth default config → `uiConfigToGenerationOptions(...)`.
2. `const seq = await getGenerationOrchestrator().generateSequence(options)` —
   the real service, returns the sequence.
3. Writes `seq` into the **current tab's real `SequenceState`** (the active tab's
   state from `create-module-state`, not `createTutorialState`).
4. Persists via `LibrarySaveService.saveSequence(seq, { visibility: "private",
   name: <simplified word> })` so "keep" is real. Name uses
   `simplifyRepeatedWord` (`simplified-word-display` rule).

**Failure behavior (named).**
- Generation throws or returns empty → starter **stays visible**, no persist, no
  `_generated`/`_kept` event, inline "Couldn't generate — try again."
- Persist fails (Dexie) → the existing `saveSequence` error surfaces
  (`library-save-service.ts:182-200`); the starter reports "generated but not
  kept," and the Leak-B prompt does **not** fire (no confirmed persist).
- Only after a confirmed persist does the command emit `_kept` and hand off to the
  Part B coordinator.

**Buttons.**
- Primary **"Generate my first sequence"** → `startFirstSequence()`.
- Secondary **"I'll build my own"** → dismiss (flag set) → Construct start-picker.
  `CreateTutorialWizard` stays reachable via Settings replay.

**Gate — `firstSequenceStarter.eligible` (async-resolved, three-state).**
`unknown` until the account-aware library read resolves; then `true` only when:
1. Create workspace is empty (`isWorkspaceEmpty()`), and
2. resolved library count is 0 — **guest → Dexie presence; full account →
   Firestore library** (never the global Dexie count), and
3. the starter has not been dismissed (flag below).
While `unknown`, render nothing (no flash). Re-resolve on account switch and on
signed-out→anonymous promotion (mirror the cloud-gate reset in
`auth-state.svelte.ts` signout path).

**Tutorial arbitration.** While `FIRST_SESSION_ACTIVATION_ENABLED` is on **and**
the starter is eligible, `CreateModule` suppresses the automatic
`offerCreateTutorial()` call (`:433-435`). Flag off → legacy behavior unchanged.
Settings replay of the wizard is never suppressed.

**Dismissal flag.** New `firstSequenceStarterState`, mirroring
`first-run-state.svelte.ts`: localStorage-first, cloud-authoritative under
`users/{uid}/onboarding/firstSequenceStarter`, **reset-to-default on a missing
doc** (a shared browser never inherits a prior account's dismissal), synced at
boot in `auth-boot-orchestrator.ts`. Set on either button.

**Library dead-end fix.** The "make your first sequence" CTA is added in the
**library-view host** (`AllLibraryView`), or by passing `BrowsePanel` an explicit
`emptyAction` prop — **not** in the shared `BrowsePanel` empty state (which also
means "filters returned zero" for pickers/sheets). It shows only for a truly-empty
`my-library` source, routes to Create, and re-arms the starter for this session
(a **volatile** override, not a cloud-dismissal clear). Design-system button, no
bare link (`clickables-look-like-buttons`).

### Part B — Proactive "keep your work" on first save (replaces the toast)

**Post-save coordinator (new, root-owned).** A single
`postSaveActivation.onSaveOutcome(outcome)` entry point owned at the app root
(alongside the other root activation UI). `saveSequence` (and the two bypass save
paths) return/emit a `SaveOutcome { persisted: boolean; isGuest: boolean;
sequenceId }`. The coordinator, **after the save surface closes**
(`save-panel-state.svelte.ts:259`), decides whether to mount the prompt. This
removes `maybeNudgeGuestToSignUp` from `LibrarySaveService` (the service no longer
renders/toasts a nudge).

**Trigger (re-scoped).** Fire when: `persisted === true` **and** the user is still
a guest **and** this guest UID has not yet been shown the actionable prompt
(versioned guard key, below). This reaches **existing** leaked guests (1+ saves
already) — the old `guestCount === 0` test would have skipped them.

**Coverage.** Because the coordinator is fed by a `SaveOutcome`, the two paths that
bypass `LibrarySaveService` participate: viewer save
(`library-action-handler.svelte.ts:91`) and printed-card import
(`ScanCardSheet.svelte:190`) both emit the same outcome. If the requirement is
"every guest save," this is the shared post-save seam that delivers it.

**Prompt (uses the real primitive).** The coordinator mounts `AuthNudge`
(via `BaseModal`, the existing overlay pattern) with:
- `onCreateAccount` → `authDrawerState.show("signup", "guest-first-save")` →
  `AuthModal` guest branch → `upgradeAnonymousWith*` (uid + sequences preserved).
- `onLogin` → existing login flow, **instrumented separately** (do not drop it).
- `onDismiss` → record decline, set the guard.

**Preservation caveat (Finding 9).** The happy path (link) preserves in place. For
the non-link routes reachable from the modal (One Tap, cross-browser email link,
credential collision), the just-saved sequence is protected by the standard cloud
sync on save; the spec does **not** claim in-place uid preservation for those, and
the implementation plan will confirm the collision path imports the local
sequence rather than stranding it.

**Copy.** New `AuthNudgeTrigger` key `guest-first-save`, following the one-phrasing
rule (no "still here tomorrow" overstatement — cleanup is 30-day-inactivity and the
Dexie copy may remain):

> "Create a free account to keep your sequences and find them on any device."

**Once-only guard.** New `guestFirstSavePromptState` — a **versioned** localStorage
key scoped to the guest UID (not the old toast's `tka-guest-save-nudge-seen`;
reusing it would exclude guests who only ever saw the weak toast). Moot after
conversion.

### Data flow

```
First-timer lands on Create (Construct, empty), gate resolves eligible
  → FirstSequenceStarter (replaces picker)
     ├─ "Generate my first sequence"
     │     → startFirstSequence(): generateSequence() → real SequenceState → saveSequence()
     │         persisted=true, isGuest → SaveOutcome → postSaveActivation
     │             → (after save surface closes) AuthNudge("guest-first-save")
     │                 → "Create account" → authDrawerState.show("signup", "guest-first-save")
     │                     → upgradeAnonymousWith* → uid + sequences preserved
     └─ "I'll build my own" → dismiss (flag) → Construct start-picker

Any later guest save (create panel / viewer / card import) → SaveOutcome
  → postSaveActivation → prompt once per guest UID
```

## Files

**New (each single-purpose; grep confirmed no existing equivalent):**
- `onboarding/components/first-run/FirstSequenceStarter.svelte` — the CTA card.
- `onboarding/state/first-sequence-starter-state.svelte.ts` — dismissal flag
  (local + cloud + missing-doc reset) and the three-state async eligibility.
- `onboarding/services/start-first-sequence.ts` — the headless generate-then-keep
  command.
- `onboarding/state/post-save-activation-state.svelte.ts` — root-owned coordinator
  + versioned per-guest guard.

**Changed:**
- `features/library/services/library-save-service.ts` — return a `SaveOutcome`;
  **remove** `maybeNudgeGuestToSignUp` (moved to the coordinator).
- `sequence-viewer/state/library-action-handler.svelte.ts` and
  `browse/collections/components/ScanCardSheet.svelte` — emit `SaveOutcome` to the
  coordinator (so their guest saves prompt too).
- `create/shared/components/CreateModule.svelte` — mount `FirstSequenceStarter`
  under the gate; suppress `offerCreateTutorial()` while eligible + flag on.
- `<app root>` (MainApplication) — mount the post-save activation prompt host.
- `library/.../AllLibraryView` (or `BrowsePanel` `emptyAction` prop) — the
  library-empty CTA.
- `auth/domain/auth-nudge-trigger.ts` — add `guest-first-save` key + copy.
- `auth/services/auth-boot-orchestrator.ts` — read/reset the starter doc at boot.
- `analytics/services/onboarding-events.ts` — new events (below).
- `onboarding/domain/onboarding-flags.ts` — `FIRST_SESSION_ACTIVATION_ENABLED`.

## Analytics

Follow the existing `onboarding_*` namespace. Emit `shown` only after visible mount,
`kept`/`generated` only after confirmed success.
- `onboarding_first_sequence_starter_shown` / `_generated` / `_kept` / `_dismissed`.
- `onboarding_guest_first_save_prompt_shown` / `_accepted` / `_declined` /
  `_login` (login action instrumented separately).
- Principal funnel (PostHog): `user_signed_up → sequence_save` in the same session,
  with starter steps between; and the guest funnel
  `guest_first_save_prompt_shown → guest_upgraded_to_account`. Report the overall
  funnel too, so starter abandonment/displacement is visible. Choose
  first-occurrence settings deliberately.

## Success metrics (post-ship, from PostHog)

- **Leak A:** share of new real signups with ≥1 `sequence_save` in the first
  session rises from the near-zero baseline.
- **Leak B:** `guest_first_save_prompt_shown → guest_upgraded_to_account` is
  measurable and non-trivial — and now reaches existing 1-save guests.
- Guardrail: starter `_dismissed` rate; no drop in overall Create engagement.

## Rollout / flags

- `FIRST_SESSION_ACTIVATION_ENABLED` (compile-time) gates both behaviors for a
  clean deploy-time on/off, mirroring `CREATE_TUTORIAL_ENABLED`. **A constant is a
  deploy switch, not a dark rollout** — if percentage targeting or instant rollback
  is wanted, back it with the existing PostHog kill-switch path
  (`post-hog-feature-flag-service.svelte.ts:235`). The plan will pick one; default
  is the constant for v1.
- No `firestore.rules` change (new doc under the permitted `users/{uid}/onboarding/*`).

## Testing

Unit (vitest, `--config tests/config/vitest.config.ts`):
- Gate is `unknown` until the library read resolves; never flashes; `true` only for
  empty workspace + resolved-zero-library + not-dismissed; account-aware
  (guest→Dexie, full→Firestore), not global Dexie count.
- Account A dismissal → signout → account B with a missing doc ⇒ starter eligible
  for B (missing-doc reset), dismissal not inherited.
- Session re-arm (library CTA) is volatile and does not overwrite the persistent
  cloud dismissal.
- `startFirstSequence`: generation failure leaves the starter visible, emits no
  `_generated`/`_kept`; success writes to the real `SequenceState` (not
  `createTutorialState`) and persists before emitting `_kept`.
- Dexie persist rejection ⇒ `SaveOutcome.persisted === false` ⇒ prompt neither
  shows nor consumes the guard.
- First-save prompt fires exactly once per guest UID; reaches an existing guest who
  already has one save; never for full accounts; never on the 2nd prompt.
- Two concurrent new saves ⇒ one prompt; respects the guest cap.
- Viewer save and card-import save paths emit `SaveOutcome` and participate in the
  same policy.
- Prompt shows only after visible mount **and** after the save surface closes.
- Feature flag off ⇒ legacy `offerCreateTutorial()` preserved, no guards consumed.
- Contract: `guest-first-save` in `AUTH_NUDGE_TEXTS`; `AuthModal` renders its copy
  for that reason (extends the existing 11-key trigger-map test).

Manual (evidence per `verification-protocol`): **fresh anonymous guest** →
generate → kept → prompt appears once after the save surface closes; "Not now"
dismisses and a 2nd save does not re-prompt; convert preserves the saved sequence.
A **fresh full account** never sees the first-save prompt. Library-empty CTA is
absent from filtered-zero states, pickers, and sheets.

## Open questions

None blocking. Default Create tab stays Construct (confirmed). Flag mechanism
(constant vs PostHog-backed) decided in the plan; default constant.

## Requirements ledger

- [ ] `start-first-sequence.ts` headless command: `generateSequence` → real
  `SequenceState` → persist, with named generation/persist failure behavior
- [ ] `FirstSequenceStarter.svelte` renders under the three-state gate; replaces the
  Construct picker until resolved; no flash while `unknown`
- [ ] Account-aware eligibility (guest→Dexie, full→Firestore), account-switch
  re-resolve, signed-out→anon re-resolve
- [ ] Tutorial arbitration: suppress `offerCreateTutorial()` while eligible + flag on
- [ ] `first-sequence-starter-state` dismissal flag (local + cloud + missing-doc
  reset + boot sync)
- [ ] Library-empty CTA in the library-view host (not shared `BrowsePanel` empty
  state); volatile session re-arm
- [ ] `SaveOutcome` returned by `saveSequence`; emitted by viewer + card-import paths
- [ ] `post-save-activation-state` root coordinator; mounts `AuthNudge` after save
  surface closes; versioned per-guest-UID guard
- [ ] Remove `maybeNudgeGuestToSignUp` toast from `LibrarySaveService`
- [ ] `guest-first-save` nudge key + one-phrasing copy
- [ ] "Create account" → `upgradeAnonymousWith*`; Log-in kept + instrumented;
  non-link routes flagged (no silent in-place-preserve claim)
- [ ] Analytics events (`onboarding_*` namespace) + PostHog funnels
- [ ] `FIRST_SESSION_ACTIVATION_ENABLED` flag
- [ ] Unit + manual tests per the list above
- [ ] `npm run check` clean; manual verification evidence captured

## Related

- `project_onboarding_remediation` (the 2026-07-19 hardening this builds on)
- `project_guest_access_tier` (three-tier model, play-first nudge philosophy)
- `.claude/rules/never-hand-roll.md`, `primitive-discovery.md`,
  `no-layout-shift.md`, `clickables-look-like-buttons.md`, `no-checkboxes.md`,
  `simplified-word-display.md`
- `docs/superpowers/specs/active/2026-07-18-onboarding-remediation-index.md`
