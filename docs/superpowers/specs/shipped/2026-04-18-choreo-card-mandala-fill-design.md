# ChoreoCard Mandala Fill — Design

**Date:** 2026-04-18
**Status:** Approved, ready for implementation plan

## Problem

ChoreoCard layouts leave empty cells in column 0 (start position column) for most sequence lengths. These empty cells waste visual real estate and leave the card feeling unfinished. The existing `SequenceMandala` renderer already produces a beautiful path-decomposition visualization that currently only appears on the back of physical printed cards — it's invisible to users downloading ChoreoCard PNGs from the app.

Filling empty cells with mandala variants turns the ChoreoCard front into a richer artifact that shows:
- The per-hand path decomposition (blue mandala, red mandala)
- The unified path signature (full mandala)

This complements rather than duplicates the physical card's back, because the front decomposes and the back unifies.

## Scope

**In scope — sequence lengths that ship publicly:**
4, 6, 8, 10, 12, 16.

Other lengths (5, 7, 9, 11, 13–15, 17+) inherit the general rule but aren't optimized for. If the app later ships those lengths, iterate.

**Out of scope:**
- Short sequences (steps ≤ 3). No mandala regardless of empty cells.
- Layout modes where `includeStartPosition = false` (no column 0 to place mandalas in).
- Non-portrait export layouts.

## Layout Changes

Only two lengths need a layout table change. Everything else uses the existing layout.

### 4-count — switch to horizontal 4×2

Current: `3×2` packed.
New: `4×2` with a metadata top row.

```
Row 0: [Start]   [Blue mandala]  [Red mandala]  [QR]
Row 1: [Beat 1]  [Beat 2]        [Beat 3]       [Beat 4]
```

This breaks the project-wide "vertical card" convention. The break is justified because row 0 is semantically distinct from the beat grid — it's a metadata strip (identity, path decomposition, scan-to-open), not a sequence continuation.

### 6-count — switch to 4×3

Current: `4×2` packed.
New: `4×3` with 3 dead cells in the bottom row.

```
Row 0: [Start]    [Beat 1]  [Beat 2]  [Beat 3]
Row 1: [Mandala]  [Beat 4]  [Beat 5]  [Beat 6]
Row 2: [QR]       [_]       [_]       [_]
```

The dead cells are ugly, but accepted because 6-count sequences are uncommon and the information gain (even a single full mandala) is worth it.

### No layout change

| Steps | Layout | Col-0 empties | Action |
|---|---|---|---|
| 8 | 3×4 | 2 | Blue (row 1) / Red (row 2) |
| 10 | 3×5 | 3 | Blue / Full / Red sandwich |
| 12 | 4×4 | 2 | Blue / Red |
| 16 | 5×4 | 2 | Blue / Red |

## Mandala Placement Rule (general)

The rule generalizes across all step counts:

| Col-0 empty cells | Mandala variant |
|---|---|
| 0 (only 4-count) | Special 4×2 horizontal layout, Blue + Red in metadata row |
| 1 | Full |
| 2 | Blue (top) / Red (bottom) |
| 3 | Blue / Full / Red (sandwich) |
| 4+ | Cap at 3 mandalas: Blue / Full / Red centered in col 0, remaining empties blank |

Step-area leftover cells (any empty cell NOT in col 0) always stay blank. They'd interrupt the beat grid.

## Hand Visibility Respect

Export settings include toggles for blue/red motion visibility. Mandalas respect these:

- **Both visible** → normal split/full/sandwich as above.
- **Red hidden** → only the blue mandala slot renders (with `show="blue"`). Full slot and red slot go blank. In the 4-count horizontal case, the red mandala cell in the metadata row is blank.
- **Blue hidden** → symmetric.
- **Both hidden** → all mandala cells blank (same as "mandala toggle off").

Rationale: rendering a "blue-only" full mandala in the sandwich case would look visually identical to the blue slot above it — two copies of the same image across two cells. Cleanest rule: hiding a hand collapses the mandala display to just the visible hand's slot. Hidden-hand slots and now-redundant full slots go blank.

## Export Settings Toggle

New toggle in the Export Settings panel: **"Mandala"**.

- Default: **on**.
- When on: layout changes and mandala rendering apply as described.
- When off: ChoreoCard reverts to current layouts (4-count stays 3×2, 6-count stays 4×2). No mandalas rendered on any length.

The toggle lives in the same panel section as the existing pictograph visibility toggles.

## Rendering

Reuse the existing `<SequenceMandala>` component. No new rendering code required.

Props passed per cell:
- `sequence={sequenceData}` — the same sequence ChoreoCard already has.
- `mode="card-back"` — transparent background, no grid dots (already implemented).
- `show="blue" | "red" | "both"` — per cell.
- `size={cellSize}` — matches the beat cell size.

## Data Flow

1. ChoreoCard receives sequence + export settings.
2. Layout calculator returns `[cols, rows]`.
3. New helper `getMandalaPlacements(cols, rows, stepCount, startInColumn)` returns an array of `{ row, col, variant: "blue" | "red" | "full" }` entries.
4. ChoreoCard's cell-rendering loop checks this array for each (row, col) and renders `<SequenceMandala>` with the appropriate `show` prop if a placement exists, else renders the normal cell contents (start / step / QR / blank).

The 4-count horizontal special case is handled inside the layout calculator: when step count is 4, `includeStartPosition` is true, `startPositionLayout === "column"`, and the mandala toggle is on, return `[4, 2]` and mark the layout as "metadata-row" mode.

## Edge Cases & Open Questions

- **Mandala toggle on + short sequence (≤3 steps):** No mandala regardless. These sequences have no col-0 empties to fill.
- **Mandala toggle on + QR toggled off:** QR cell becomes a col-0 empty. Recount and apply rule. (Effectively one extra empty cell.)
- **Mandala toggle on + start position toggled off (includeStartPosition=false):** No col 0, no mandala. Revert to existing layout. Matches the "no-col-0" scope exclusion.
- **Printed physical cards:** Not affected by this change. The physical card's back continues to show the full mandala. The front gets mandalas *in addition* to (not replacing) the physical back mandala.

## Testing

- Unit test `getMandalaPlacements` for each in-scope step count (4, 6, 8, 10, 12, 16) and the two toggle states.
- Visual regression: render a ChoreoCard at each in-scope length and confirm mandala placement matches the table above.
- Toggle-off regression: confirm 4-count reverts to `3×2` and 6-count reverts to `4×2` when the mandala toggle is off.
- Hand visibility: render 8-count with red hidden; confirm blue mandala present, red slot blank.

## Files Likely Touched

- `src/lib/shared/render/services/implementations/LayoutCalculator.ts` — add 4-count horizontal variant and 6-count expansion when mandala is enabled; either a new method or a parameter.
- `src/lib/shared/sequence-viewer/components/ChoreoCard.svelte` — cell-rendering loop checks mandala placements; passes `SequenceMandala` in relevant cells.
- `src/lib/shared/sequence-viewer/components/ExportPopover.svelte` (or wherever export settings live) — add mandala toggle.
- New helper (location TBD during planning): `getMandalaPlacements` pure function.
- Settings state: add `includeMandala` to export settings.
