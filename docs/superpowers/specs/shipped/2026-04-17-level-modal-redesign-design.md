---
status: backlog
value: 4
effort: S
score: 16
remaining: "Full build — redesigned level selection modal"
last_triaged: 2026-04-26
---
# Level Modal Redesign — Design Spec

**Date:** 2026-04-17
**Status:** Draft — awaiting review

## Problem

Users tap the Level badge expecting a level selector. The current modal reinforces that expectation: three rows with the current level highlighted via background tint, reading as "selected option" rather than "current state." When the selected row doesn't respond to taps, users conclude the feature is broken (Austen's dad: *"it just doesn't give me the option"*).

The deeper problem underneath: users don't know what the levels *mean*. Fixing the picker illusion without teaching the level system solves half the problem.

## Goals

1. Kill the picker illusion — the modal must read as a status readout, not a control.
2. Teach the level system in the modal itself, using the existing `level_N.png` example pictographs.
3. Tell the user specifically what separates their current level from the adjacent ones ("add whole turns to reach Level 2").

## Non-Goals

- Changing the badge itself or how levels are calculated.
- Per-beat citations ("beat 3 has the turn that bumped you"). Reason granularity stays at "the feature is present" level.
- Reworking the LOOP modal. Same component, different content — out of scope for this spec.

## Design

### Layout

A single dark modal with four zones, top to bottom:

1. **Header** — existing `ModalHeader` pattern. Icon badge in the current level's color, title `Level N`, subtitle from the level name (`Base Motions` / `Whole Turns` / `Half Turns, Floats`). Close button.
2. **Row of three level cards** — always in fixed order L1 → L2 → L3. The current level's card is enlarged (≈140px pictograph, tinted background in level color, full opacity, dropped vertically so bottoms align with siblings). The other two are dimmed thumbnails (≈72px, 55% opacity). Each card shows a small level-color badge, the pictograph, and the short name.
3. **Progression text** — one paragraph that adapts to current level:
   - **L1:** "This sequence uses only base motions. Add **whole turns** to reach Level 2. Add **half turns or floats** to reach Level 3."
   - **L2:** "This sequence uses **whole turns** — that's Level 2. Add **half turns or floats** to reach Level 3."
   - **L3:** "This sequence uses **half turns or floats** — that's Level 3, the full vocabulary."
   - Emphasis words colored in the target level's accent (`#2196F3` for L2 references, `#9C27B0` for L3 references).

Modal size bumps from `sm` to `md` to accommodate the row.

### Mobile / narrow-width behavior

Below ~480px the row collapses to a vertical stack: current level on top at full size, the other two below as dimmed thumbnails in a single horizontal mini-row. Progression text stays below. No separate mobile component — just a container query on the row.

### Assets

Use the existing static images at `/images/level_images/level_{1,2,3}.png`. Already sized and designed, already used on the landing page's `GuidesSection`. White background baked in — keep the `background: #fff; padding: 4px; border-radius: 6px` wrapper so they don't look naked against the dark modal.

### Copy source

Level names and descriptions pulled into a shared module (new file) so `GuidesSection`, `SequenceDifficultyCalculator`, and this modal share a single source. Current state: descriptions duplicated between `GuidesSection.svelte` and `difficultyDescriptions` in `SequenceDisplay.svelte`.

New file: `src/lib/shared/domain/curriculum/level-metadata.ts`

```ts
export const LEVEL_METADATA = {
  1: { name: "Base Motions",       blurb: "The grid, all 6 letter types, basic words. No turns.", image: "/images/level_images/level_1.png", accent: "#4CAF50" },
  2: { name: "Whole Turns",        blurb: "Whole turns. Shifts get rotation, combos get harder.",  image: "/images/level_images/level_2.png", accent: "#2196F3" },
  3: { name: "Half Turns, Floats", blurb: "Half turns, floats. The full vocabulary.",              image: "/images/level_images/level_3.png", accent: "#9C27B0" },
} as const;
```

`GuidesSection` and the new modal both consume this. `accent` feeds the progression-text emphasis colors (the green/blue/purple from `GuidesSection`, not the pastel badge colors).

Badge styling remains in the existing `DIFFICULTY_LEVELS` map (`src/lib/shared/config/difficulty-styles.ts`) — this spec does not duplicate or change it. The two maps are complementary: `DIFFICULTY_LEVELS` = how badges look, `LEVEL_METADATA` = what levels mean.

### Calculator contract extension

`SequenceDifficultyCalculator` currently returns just `number`. The progression text doesn't strictly need a reason (it's derivable from the level number alone: L2 → triggered by turns, L3 → triggered by non-radial). But a new method makes the intent explicit and covers the edge case where the two triggers disagree.

Add to `ISequenceDifficultyCalculator`:

```ts
type DifficultyTrigger = "none" | "turns" | "nonRadial";

interface DifficultyAnalysis {
  level: 1 | 2 | 3;
  trigger: DifficultyTrigger;
}

analyzeDifficulty(steps: StepData[]): DifficultyAnalysis;
```

Implementation lifts the existing `hasTurns` / `hasNonRadialOrientation` internals. Old `calculateDifficultyLevel` stays as-is — all 15 existing call sites keep working, no migration. The modal is the only consumer of the new method.

### Component structure

New component: `LevelInfoModal.svelte` in `src/lib/features/create/shared/workspace-panel/sequence-display/components/`.

Props:

```ts
{
  open: boolean;
  analysis: DifficultyAnalysis;
  onclose: () => void;
}
```

`SequenceDisplay.svelte` owns the `open` state and calls `analyzeDifficulty()` in a `$derived`. The LOOP modal stays inline in `SequenceDisplay` (different content, no extraction pressure yet) — but if this new component extracts cleanly, the LOOP modal can follow the pattern later. Not this spec.

### Extracted sub-component

The row of three level cards lives in its own component: `LevelProgressionRow.svelte`. Takes `currentLevel: 1 | 2 | 3` as a prop. Renders the three cards with the enlarge/dim treatment. Kept separate so it's reusable on the landing page's `GuidesSection` if we later want the same row-as-progression affordance there — not a goal of this spec, but a cheap option to preserve.

## Files touched

**New:**
- `src/lib/shared/domain/curriculum/level-metadata.ts`
- `src/lib/features/create/shared/workspace-panel/sequence-display/components/LevelInfoModal.svelte`
- `src/lib/features/create/shared/workspace-panel/sequence-display/components/LevelProgressionRow.svelte`

**Modified:**
- `src/lib/features/browse/sequences/display/services/contracts/ISequenceDifficultyCalculator.ts` — add `analyzeDifficulty` method and `DifficultyAnalysis` / `DifficultyTrigger` types.
- `src/lib/features/browse/sequences/display/services/implementations/SequenceDifficultyCalculator.ts` — implement `analyzeDifficulty`. Refactor `calculateDifficultyLevel` to delegate to it.
- `src/lib/features/create/shared/workspace-panel/sequence-display/components/SequenceDisplay.svelte` — replace inline difficulty modal with `<LevelInfoModal>`. Remove local `difficultyDescriptions` dict (move to shared metadata).
- `src/routes/landing/components/GuidesSection.svelte` — read from shared `LEVEL_METADATA` instead of inline array.

## Testing

Silent-bug territory per project testing philosophy:

- **Unit:** `SequenceDifficultyCalculator.analyzeDifficulty` — one test per trigger path (empty → `{1, "none"}`, turns-only → `{2, "turns"}`, non-radial → `{3, "nonRadial"}`).
- **Visual:** no automated test. Spot-check with Chrome DevTools MCP (user-approved) that the modal renders correctly at L1, L2, L3 current states and at narrow viewport.

## Open questions

None for the user — all design choices above are recommendations from the brainstorm. Flag any objections in spec review.
