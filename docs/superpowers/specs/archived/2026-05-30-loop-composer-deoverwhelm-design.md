---
status: archived
value: 3
effort: S
remaining: ""
depends_on: ""
plan_path: ""
tags: []
superseded_by: src/lib/features/choreo-card/components/deck-releaser/LoopBentoBoard.svelte
last_triaged: 2026-07-29
---
# LOOP Catalog Composer — De-Overwhelm Redesign

**Date:** 2026-05-30
**Status:** Shipped 2026-05-30, then superseded in production 2026-05-31.
**Prototype:** `src/routes/test/deck-releaser-configure/` (real components, no mockup).

> **ARCHIVED 2026-07-29.** Commit `d2b1e9c852` shipped this three-column
> design as `LoopComposeBoard.svelte`. Commit `4fc09f3831` deliberately replaced
> it in production with the seeded-recipe `LoopBentoBoard.svelte` the next day.
> The original board remains in its test harness as a historical prototype.
> Reapplying this spec would roll production back to the older configuration
> model.

## Problem

"Compose Your Catalog" has two modes. The **TnD** board is calm — two concrete pickers (`TnDFamilyCards`, `TnDTurnMatrix`) plus a Transform rail. The **LOOP** board overwhelmed: 4 weight sliders with %/~cards/pool counts, two competing preset rows, oversized Total-Cards buttons, a floating detached Reversal card, and a void of empty space. Color was over-applied (teal/orange/purple orientation cards, blue/gold grid). Austen: *"making my brain feel overwhelmed."*

## Goals

1. Cut the resting LOOP view to a handful of high-level decisions; hide precision behind opt-in disclosure.
2. Bring LOOP into TnD's section-board grammar with a **shared Transform rail**.
3. Reserve color for the elemental families (the one place color carries meaning).
4. No layout shift; reuse existing primitives (never hand-roll).

## Design (converged in harness)

### Shared Transform rail (both modes)
`TransformPanel` (Orientations · Grid · Reversal) is the right-hand rail in **both** LOOP and TnD. Removes LOOP's scattered orientation/grid `AxisCardGroup`s and the floating Reversal card.

### LOOP board — three columns
- **Left — Source:**
  - `AxisCardGroup` for Source Decks (Halved / Quartered, mono accent, catalog count sub-line).
  - `SegmentedControl` (size `sm`) for **Deck Size** (26 / 36 / 52) — quiet, de-emphasized.
  - **"This Deck" recipe** — live plain-English readout (Cards / Source / Step Count / Turns / Orientation / Grid / Reversal). Makes the abstract config legible and fills what was dead space, balancing column heights.
- **Center — Deck Shape:**
  - Two single-tap `SegmentedControl` rows: **Step Count** (Beginner / Balanced / Advanced) and **Turn Variation** (Clean / Sprinkle / Spicy). Each is exactly-one-active (chip-primitives routing rule).
  - **"Customize mix & turns"** via `CollapsibleLabSection` — holds the 4 step-weight sliders (% / ~cards / pool counts) + turn-density slider + turn-pattern `FilterChipBase` toggles. `defaultOpen` so the center column reads full rather than leaving a void; collapsible for users who want it calm.
- **Right — Transform rail:** `TransformPanel` with `reversalCustomDefault={false}` so the cryptic Blue/Red spin matrix folds behind "Custom"; resting Reversal = 6 named presets + compact summary.

### Primitives reused (no hand-rolling)
`SegmentedControl`, `AxisCardGroup`, `FilterChipBase` (toggle + action), `CollapsibleLabSection`, `TransformPanel` → `ModifierAxis` + `TnDReversalStrip`. Weight sliders follow the established effects-panel `<input type="range">` + `accent-color` pattern (no shared slider primitive exists; extracting one is a separate consolidation, out of scope).

### Layout stability
All changing numerics (%/~cards/pool/turn density) use `font-variant-numeric: tabular-nums` in fixed-width grid columns so dragging never reflows rows (no-layout-shift rule).

## Shared-component changes (already landed, default-preserving)
- `TnDReversalStrip`: new optional `startCustomOpen = true` (legacy expanded). The rail passes `false` for preset-first resting view.
- `TransformPanel`: new optional `reversalCustomDefault = true`, forwarded to the strip.

Production behavior unchanged unless a caller opts in.

## Out of scope — deferred
See memory `project_catalog_composer_grid_pictographs`:
- Pictograph Grid / Orientation buttons (real `PictographRenderer`, not glyphs).
- Grid-as-start-position-subgroup framing + seed/representative parameter.

Parked to focus on shipping printable, cuttable decks.

## Promotion Constraints (read before implementing)

The production target `ConfigureStep.svelte` is rendered by `DeckReleaserTab.svelte`, which at time of writing has a large **uncommitted in-flight refactor** (print state lifted from `ReviewStep` into `DeckReleaserTab`, new sidebar `PrintPanel`). The shared `TnD*` components are being committed by that session.

**Do not begin the production port until that refactor is committed and the deck-releaser files are quiescent.** Editing `ConfigureStep` / `DeckReleaserTab` concurrently risks clobbering hours of another session's work (git-safety + commit-only-own-changes). Confirm no active session before editing.

## Implementation outline (when unblocked)
1. Rebuild `ConfigureStep`'s LOOP branch from `LoopConfigurePrototype` (Source + Size + recipe | Deck Shape + Customize | Transform rail). Existing props from `DeckReleaserTab` already supply weights/totalCards/sources/variationConfig/reversalPattern — verify no new prop plumbing needed.
2. Replace hand-rolled `count-btn` / `source-btn` / `preset-btn` / `toggle-chip` with the primitives above.
3. Pass `reversalCustomDefault={false}` to the LOOP rail's `TransformPanel`.
4. Verify TnD board unaffected.
5. `npm run check` + visual verification at the real route.
6. Commit with explicit pathspec (only `ConfigureStep` + any LOOP-only files I create).
