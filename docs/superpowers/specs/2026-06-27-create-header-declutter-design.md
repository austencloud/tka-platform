# Create Header & Generate-Panel Declutter — Design

**Date:** 2026-06-27
**Status:** Design (pending review)
**Author:** Austen + Claude (brainstorm)

## Problem

The Create workspace shows classification metadata and a discovery button that
educate users before they have the hooks to absorb them:

1. **Generate guide button** (`GeneratorHelpButton`, mobile-only) is a permanent
   3rd button on the right of the action bar. On mobile the bar carries 6 buttons
   (2 left, 1 center, 3 right) — crowded and unbalanced. The guide it opens is
   well-built and delightful, but a first-run discovery affordance does not earn a
   *permanent* slot: tweakers tweak regardless, overwhelmed users will not open a
   guide, and the curious self-select. Discovery is a one-time *moment*, not a
   fixture. A polished button on a misplaced element reads as "belongs here," which
   is why the placement issue was easy to miss.

2. **Loop-type + level indicators** sit in the always-on create header
   (`SequenceDisplay` top-bar). They are *classifications*, not controls. A label
   only teaches a viewer who already has the vocabulary; to a newcomer
   "Rotated LOOP · Level 4" is jargon noise. They belong where they are earned
   (cards, viewer, exports), not shoved at the user mid-create.

This change is subtractive: a calmer header, a balanced action bar, and a
gentler, first-run-only path into the existing tour. No craft is deleted — the
tour and its animations are preserved and re-homed.

This aligns with the broader 2026-06 declutter direction (cf. XP/gamification
teardown, viewer prop-toggle removal).

## Decisions (locked during brainstorm)

| Question | Decision |
|---|---|
| Guide re-home | First-run gentle inline offering + quiet replay (not a permanent button) |
| First-run style | Gentle **inline** offering in the empty-state slot — never a modal interrupt (honors the deliberate `AUTO_TOURS_ENABLED = false` "zero interruptions" stance) |
| Mobile replay home | Settings "replay tutorials" (matches existing `appEntryState.replay` pattern) |
| Loop/level demote | **Gone from Create** entirely; still visible on cards / viewer / exports |
| Freed corners | Leave empty — do not add a profile indicator now |

## Scope — three decoupled changes

### A. Generate guide: permanent button out, first-run offering in

**Remove**

- `GeneratorHelpButton` block in
  `src/lib/features/create/shared/workspace-panel/shared/components/ButtonPanel.svelte:139-147`
  (right zone). Mobile right-side count goes 3 → 2; the bar balances at 2 left /
  1 center / 2 right.
- The now-orphaned attention overlay
  `src/lib/features/create/generate/components/help/HelpButtonDiscovery.svelte`
  and its mount + its `helpButtonDiscoverySeen:generate` flag handling. With no
  button to point at, the discovery overlay has no referent.
- `panelState.triggerGeneratorHelpMode()` wiring is retained only if still used by
  the desktop help entry; otherwise removed. (Plan verifies the desktop path in
  `GeneratePanel.svelte` and keeps it intact.)

**Keep — zero craft lost**

- `src/lib/shared/onboarding/components/generate-tour/GeneratePanelTour.svelte`
  (all micro-animations: card pulse, slide transitions, progress dots).
- `src/lib/shared/onboarding/state/generate-tour-state.svelte.ts` (start/advance/
  restart/complete + localStorage persistence).
- `src/lib/shared/create/domain/card-registry.ts`,
  `src/lib/shared/create/domain/generator-help-content.ts`.
- The existing **desktop** help entry in `GeneratePanel.svelte` stays as-is
  (desktop bar is not crowded; this is a mobile-only crowding fix).

**Add — first-run inline offering in the existing empty-state slot**

The empty generate state already renders a hint in the space above the option
cards (`src/lib/features/create/shared/components/StandardWorkspaceLayout.svelte:214-216`):

```svelte
{#if !hasWorkspaceContent && isGeneratorTab}
  <p class="workspace-hint">Tap Generate to create your sequence</p>
{/if}
```

On the **first** generate visit only (gated by a dedicated localStorage flag in
the onboarding storage-keys pattern — e.g. `tka-generate-tour-offered`), this slot
renders a gentle inline offering in place of the plain hint:

- Soft one-line prompt offering a short tour of the generate options, with two
  affordances styled as buttons (per `clickables-look-like-buttons`): **Show me**
  and **No thanks**.
- **Show me** → `generateTourState.start()` and set the offered-flag.
- **No thanks** → set the offered-flag, revert to the normal `.workspace-hint`.
- After the flag is set, the offering never auto-appears again; the slot shows the
  normal hint.

Properties:

- **Inline, non-modal.** No popping dialog — consistent with the codebase's
  deliberate "new users get zero modal interruptions" stance
  (`onboarding-flags.ts`, `AUTO_TOURS_ENABLED = false`).
- **Cross-platform by construction.** It lives in the slot that already adapts to
  both mobile (stacked) and desktop (side-by-side) via
  `shouldUseSideBySideLayout`. No separate mobile/desktop treatment needed.
- **No layout shift** (`no-layout-shift`): the slot already reserves this region;
  the offering must size within it without shoving the cards.

**Add — quiet replay in Settings**

A "replay tutorials" entry already exists in Settings that invokes
`appEntryState.replay` (per `onboarding-flags.ts`). Add a parallel entry there that
calls `generateTourState.restart()` (or `start()`), so curious users who skipped
the offering can replay the generate-options tour on any device. The plan locates
the exact Settings component that hosts the existing replay path.

### B. Loop + level indicators out of the always-on create header

Both badges live in the `SequenceDisplay` top-bar and already open info modals on
click:

- **DifficultyBadge** (level) — `SequenceDisplay.svelte:198-209` (`.top-left-zone`),
  modal `LevelInfoModal.svelte`.
- **LOOPIconStrip** (loop type) — `SequenceDisplay.svelte:220-236`
  (`.top-right-zone`), modal `LOOPInfoModal.svelte`.
- **WordLabel** (center) — stays. The clean header is the word alone.

**Remove** both badge buttons (and their now-unused modal mounts) from the
top-bar. With both side zones empty, simplify the `.top-bar` layout so the word
sits cleanly (left/right 40px reserve zones collapse).

**Preserve — data model + calculators (used elsewhere, must stay):**

- `SequenceData` fields: `loopType`, `components`, `componentDomains`, `period`,
  `level` (`src/lib/shared/foundation/domain/models/sequence-data.ts`).
- `analyzeDifficulty()`
  (`src/lib/shared/browse/services/sequence-difficulty-calculator.ts`).
- `resolveLoopDisplay()`
  (`src/lib/features/loop-labeler/services/loop-display-resolver.ts`).
- `DifficultyBadge` and `LOOPIconStrip` components themselves — still consumed by
  `CardHeader.svelte`, `CardBack.svelte`, `BrowseGrid.svelte`,
  `WordHeader.svelte`, etc. Only the **create-header mounts** are removed, not the
  components.

Classification therefore remains visible everywhere it is earned (cards, sequence
viewer, exports) and disappears only from the always-on create surface.

`LevelInfoModal.svelte` / `LOOPInfoModal.svelte` become orphaned if nothing else
mounts them — the plan greps for other consumers and removes them only if create
was the sole caller.

### C. Freed corners — leave empty

Do not add a profile indicator (or anything) to the corners freed by removing the
badges. Ship the calmer layout and let any future occupant earn its slot. Empty
corners are the feature here, not a vacancy to fill.

## Non-goals / out of scope

- No change to the tour content, steps, or animations.
- No change to how loop type / level are computed, persisted, or displayed on
  cards / viewer / exports.
- No new profile/account UI.
- No change to the desktop generate help entry.
- No change to the `AUTO_TOURS_ENABLED` flag or the create-tutorial (guided build)
  flow — those are a separate system.

## Verification

- **Build/type:** `npm run check` clean.
- **Mobile action bar:** generate tab, sequence present → exactly 2 left / 1
  center / 2 right buttons; no guide button. Screenshot.
- **First-run offering:** clear the offered-flag → first generate visit shows the
  inline offering in the empty-state slot on both a mobile and a desktop viewport;
  **Show me** launches the tour; **No thanks** reverts to the hint; reload → offering
  does not reappear; normal hint shows. Screenshots both viewports.
- **Replay:** Settings "replay tutorials" entry launches the generate tour.
- **Header:** create header shows the word only — no level/loop badges — on all
  create tabs. Screenshot.
- **No regression elsewhere:** cards, sequence viewer, browse grid still render
  level + loop badges (data + components intact). Spot-check a card render.
- **No layout shift:** the offering appears/dismisses without moving the option
  cards.

## Files touched (anticipated)

| File | Change |
|---|---|
| `ButtonPanel.svelte` | Remove `GeneratorHelpButton` block + import |
| `HelpButtonDiscovery.svelte` (+ mount) | Remove orphaned overlay + flag |
| `StandardWorkspaceLayout.svelte` | First-run inline offering in empty-state slot |
| (new) generate first-run offering component | Inline offering UI (reuse button primitive) |
| onboarding storage-keys | Add `tka-generate-tour-offered` flag helper |
| Settings replay surface | Add "replay generate options tour" entry |
| `SequenceDisplay.svelte` | Remove level + loop badge mounts; simplify top-bar |
| `LevelInfoModal` / `LOOPInfoModal` | Remove only if create was sole consumer |

## Related rules / memory

- `.claude/rules/never-hand-roll.md`, `primitive-discovery.md` — reuse the existing
  tour, button primitive, onboarding storage-keys, empty-state slot.
- `.claude/rules/no-layout-shift.md`, `clickables-look-like-buttons.md`,
  `no-checkboxes.md` — offering affordances are buttons, no shift.
- `feedback_design_system_mandatory` — tokens, 44px targets.
- Onboarding ecosystem: `src/lib/shared/onboarding/` (FirstRunState, TabIntro,
  OnboardingPersister, generate-tour-state).
