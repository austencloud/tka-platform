# Deck Layout Policy — Design Spec

**Date:** 2026-05-05
**Status:** Approved

## Problem

Choreo cards render in two contexts with different layout requirements:

1. **Deck tab** (Choreo Cards module) — curated physical print cards. Layout must be consistent regardless of user preferences.
2. **Sequence Viewer** (Create/Browse) — ad-hoc card preview. Layout should respect user's customizable row/column setting.

Currently, both contexts read from `ImageCompositionStateManager`, meaning a user who sets "top row" in their viewer preferences also changes how their deck cards render. Deck cards should have a fixed, step-count-dependent layout policy independent of user preferences.

## Solution

A pure function `getDeckLayoutPolicy(stepCount: number): "row" | "column"` that returns the canonical layout for physical printed cards.

### Layout Table

| Step count | Layout | Rationale |
|-----------|--------|-----------|
| 1-4 | `"row"` | Few beats — single/double row reads left-to-right naturally |
| 5+ | `"column"` | Portrait card ratio (5:7) fills better with left column start position |

The threshold at 5 aligns with `WITH_START_COLUMN` layout table in `packages/render-composition/src/layout-tables.ts` (line 167: "Portrait-optimized layout table for start position as a LEFT COLUMN. Designed for playing card aspect ratio (5:7)"). Step count 5 is where column layout first produces a multi-row grid (3x3) that uses card space efficiently.

The threshold is a single constant — easy to tune after visual comparison.

### File Location

`src/lib/features/choreo-card/domain/deck-layout-policy.ts`

Pure function, no state, no dependencies.

### Call Sites (3 total)

1. **`DeckBrowser.svelte` grid view** (line 654) — Currently passes `ChoreoCard` with no `startPositionLayout` prop (defaults to `"row"`). Change: pass `startPositionLayout={getDeckLayoutPolicy(sequence.steps.length)}`.

2. **`PrintPreviewPages.svelte` `buildRenderOptions()`** (line 104) — Currently reads `imageComposition.getStartPositionLayoutForStepCount(stepCount)`. Change: when called from deck context, use `getDeckLayoutPolicy(stepCount)` instead.

3. **`DeckFamilySection.svelte`** (line 247) — Already hardcodes `"column"`. Change: replace with `getDeckLayoutPolicy(sequence.steps.length)` for consistency.

### PrintPreviewPages Context Awareness

`PrintPreviewPages` is used by both deck context and potentially other contexts. To distinguish:

- Add an optional `deckMode?: boolean` prop (default `false`)
- When `deckMode` is true, `buildRenderOptions()` uses `getDeckLayoutPolicy(stepCount)`
- When false, continues reading from `ImageCompositionStateManager` as today

`DeckBrowser.svelte` already passes deck-specific props to `PrintPreviewPages` (like `leftLabel`, `elementFamilyId`), so `deckMode` fits the existing pattern.

### What Doesn't Change

- `ImageCompositionStateManager` — untouched, still serves viewer/designer contexts
- `ChoreoCardLayoutState` — untouched, still resolves from composition manager when no override is passed
- `CardDesigner.svelte` — designer tab keeps reading user preferences
- Sequence Viewer `ChoreoCard` — keeps its `startPositionLayoutOverride` prop for embedded contexts (landing page, marketing)
- Layout tables in `render-composition` package — unchanged

## Non-Goals

- No new state management or context providers
- No changes to the viewer's row/column toggle UI
- No persistence of deck layout policy (it's deterministic from step count)
