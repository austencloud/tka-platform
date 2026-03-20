# Choreo Card Layout Improvements

**Date:** 2026-03-20
**Status:** Draft

## Problem

Three related layout issues with choreo cards:

1. **Start position as column wastes horizontal space.** When `includeStartPosition` is true, the start pictograph occupies column 0, forcing every row to have an extra column. For a 16-step sequence, this means a 5x4 grid (20 cells, 3 empty) instead of 4x4 (16 cells, 0 empty). The QR code lives in one of those empty cells in column 0, so toggling start position off also hides the QR code.

2. **Physical printed cards have awkward white space.** The tight image (header + grid + footer) doesn't fill a playing-card aspect ratio (5:7). The gap pools at the bottom and looks like leftover space rather than intentional margin. This affects all step counts.

3. **Card back can't represent non-canonical starting positions.** The bottom-right corner uses α/β/γ SVG glyphs, which only cover three canonical position groups. Sequences starting at non-canonical positions have no representation. The glyph also doesn't communicate grid mode (box vs. diamond).

## Scope

Three independent changes. Each can ship separately.

### Change 1: Start Position as Row (experimental)

**Affects:** ImageComposer rendering, LayoutCalculator tables, everywhere the tight image appears (browse, viewer, export, print).

**Current behavior:** Start position renders as a left column. Layout uses `LAYOUT_WITH_START_POSITION` tables that add 1 to the column count. QR code finds empty cells in column 0.

**New behavior:** Start position renders as a top row above the step grid.

Layout for 16 steps with start position:
```
[Start] [      ] [      ] [QR    ]   ← start row (same cell height as steps)
[  1  ] [  2  ] [  3  ] [  4  ]     ← step grid uses WITHOUT_START column count
[  5  ] [  6  ] [  7  ] [  8  ]
[  9  ] [ 10  ] [ 11  ] [ 12  ]
[ 13  ] [ 14  ] [ 15  ] [ 16  ]
```

Rules:
- Start row uses the same cell dimensions as step cells
- Start pictograph in the leftmost cell, labeled "Start" with position group glyph below (same as current)
- QR code in the rightmost cell of the start row (hard-coded position, not scanned via `findEmptyCellForQR`)
- Middle cells of start row are empty
- Step grid below uses `LAYOUT_WITHOUT_START_POSITION` column count
- Total rows = WITHOUT_START row count + 1

**New layout table:** `LAYOUT_WITH_START_ROW` — derived from WITHOUT_START by adding 1 to the row count for each entry. The column count stays the same as WITHOUT_START.

Full derivation for common step counts:

| Steps | WITHOUT_START | WITH_START_ROW | Efficiency |
|-------|--------------|----------------|------------|
| 1     | [1, 1]       | [1, 2]         | 100%       |
| 2     | [2, 1]       | [2, 2]         | 75%        |
| 3     | [3, 1]       | [3, 2]         | 67%        |
| 4     | [2, 2]       | [2, 3]         | 83%        |
| 5     | [2, 2]       | [2, 3]         | Note 1     |
| 6     | [3, 2]       | [3, 3]         | 78%        |
| 7     | [4, 2]       | [4, 3]         | 67%        |
| 8     | [4, 2]       | [4, 3]         | 75%        |
| 9     | [3, 3]       | [3, 4]         | 83%        |
| 10    | [5, 2]       | [5, 3]         | 73%        |
| 11    | [4, 3]       | [4, 4]         | 75%        |
| 12    | [3, 4]       | [3, 5]         | 87%        |
| 13    | [4, 4]       | [4, 5]         | 70%        |
| 14    | [4, 4]       | [4, 5]         | 75%        |
| 15    | [4, 4]       | [4, 5]         | 80%        |
| 16    | [4, 4]       | [4, 5]         | 85%        |

**Note 1:** WITHOUT_START for 5 steps is `[2, 2]` = 4 cells, which is 1 cell short. This is a pre-existing issue in the layout table (the step grid slightly overfills). The row-based layout inherits this. Verify rendering works correctly for this edge case during implementation.

**ImageComposer changes:**

The rendering logic switches from a column offset to a row offset:
- Replace `startColumn` offset with a `startRow` offset: `const startRow = options.includeStartPosition ? 1 : 0`
- Steps render at: `col = stepIndex % columns`, `row = startRow + Math.floor(stepIndex / columns)`
- Start pictograph renders at (col=0, row=0)
- QR code renders at (col=columns-1, row=0) — no scanning logic needed in row mode

The old `startColumn` logic and `LAYOUT_WITH_START_POSITION` table remain in code for fallback. A flag (e.g., `startPositionLayout: "row" | "column"`) determines which mode is active. Default: `"row"`.

**Aspect ratio methods:** `calculateGalleryAspectRatio()` and `calculateThumbnailAspectRatio()` in LayoutCalculator must be updated to use the row-based layout when `includeStartPosition` is true. The gallery method always includes start position, so it will produce different aspect ratios — downstream thumbnail sizing in browse/viewer needs to accommodate this.

**Migration:** If the user doesn't like the row approach, flip the flag back to `"column"` and everything reverts.

**This is experimental.** The user will evaluate the visual result and decide whether to keep it.

### Change 2: Card Layout Mode (physical card printing)

**IMPORTANT: `printMode` vs. `cardMode` distinction.**
- `printMode` (existing) = light/white background for paper printing. Used by sequence viewer export. The image stays tight — no stretching, no aspect ratio change.
- `cardMode` (new) = render to 5:7 playing card aspect ratio with spaced header/footer. Used exclusively by the card designer when preparing physical choreo card decks.

These are separate flags. `printMode` does NOT trigger `composeCardImage`. Only `cardMode` does.

**Affects:** Card designer preview and physical card print/export pipeline only. Does NOT affect browse gallery, sequence viewer, standard image export, or printMode exports.

**Current behavior:** The card designer renders the tight image as-is onto the card preview. The image's aspect ratio doesn't match a playing card, leaving a large empty area at the bottom.

**New behavior:** When `cardMode` is true, the layout is adjusted:
- The word/header area pins to the top edge of the playing card
- The creator/footer area pins to the bottom edge
- The step grid is centered vertically in the remaining space
- Breathing room is symmetric above and below the grid

**Implementation approach:** A new composition method (e.g., `composeCardImage()`) renders to a fixed 5:7 aspect ratio canvas (500x700px):

1. Determine the grid dimensions from the layout table (same as tight image)
2. Calculate `stepSize` by fitting the grid width to the card width: `stepSize = cardWidth / columns`
3. Calculate `headerHeight = stepSize / 3` and `footerHeight = stepSize / 7` (same proportions as tight image)
4. Calculate `gridHeight = rows * stepSize`
5. Calculate `availableHeight = cardHeight - headerHeight - footerHeight`
6. Calculate `topPadding = (availableHeight - gridHeight) / 2`
7. Render header at y=0
8. Render grid at y = headerHeight + topPadding
9. Render footer at y = cardHeight - footerHeight
10. Fill background in the padding areas

**Overflow handling:** If `gridHeight > availableHeight` (very long sequences, 30+ steps), scale `stepSize` down until the grid fits within `availableHeight`. This means the pictographs will be smaller on the printed card for long sequences. Alternatively, these step counts may not be suitable for playing-card format — document this as a known limitation.

**Sweet spot:** The print layout works best for sequences in the 4-16 step range (the most common deck content). Sequences outside this range will still render but with increasingly extreme proportions.

**What stays the same:** The standard `composeSequenceImage()` method continues to produce tight images. The new method must work with both row-mode and column-mode start position layouts (whichever survives from Change 1).

### Change 3: Mini-Grid Start Position on Card Back

**Affects:** CardBackV5.svelte (bottom-right corner badge), card-back-data.ts.

**Current behavior:** Bottom-right corner shows an SVG glyph (α, β, γ) loaded from `/images/letters_trimmed/Type6/`. Only works for canonical position groups. Doesn't communicate grid mode.

**New behavior:** Bottom-right corner shows a tiny rendered grid visualization:
- Small circles at grid points — their arrangement shows the grid mode:
  - **Box mode:** 4 points at cardinal positions (N, S, E, W). Hand locations are cardinal.
  - **Diamond mode:** 4 points at intercardinal positions (NE, SE, SW, NW). Hand locations are intercardinal.
- **Red and blue filled dots** at the starting hand positions
- Unfilled/outline dots at unoccupied grid points
- Small enough to fit the existing corner badge area (~40-50px)
- Readable at playing-card print size

**Grid mode derivation:** Determined by the hand starting locations:
- If both blue and red locations are cardinal (n, s, e, w) → box mode
- If both are intercardinal (ne, se, sw, nw) → diamond mode
- If mixed (one cardinal, one intercardinal) → render all 8 points and place dots at their actual locations. This handles edge cases without special logic.

**Skewed mode:** Skewed positions (Level 4+) are out of scope for v1. The mini-grid handles box and diamond. If a skewed sequence is encountered, fall back to rendering all 8 grid points with dots at actual locations (same as mixed mode).

**What it communicates at a glance:**
- Grid mode (shape of the dot arrangement)
- Starting position group (pattern of filled dots inherently shows alpha/beta/gamma)
- Non-canonical positions (dots at positions that don't map to standard groups)
- Which hand is where (red vs. blue color)

**Replaces:** The α/β/γ glyph entirely. All cards get the mini-grid.

**Fallback:** If hand locations cannot be derived (no start position data, no first step motions), render an empty mini-grid with no filled dots. The corner space is never blank — the grid frame itself communicates "we don't know the start position" when empty.

**Data requirements:** Expand `deriveStartPositionGroup` to return a richer object instead of a plain string:

```typescript
interface StartPositionInfo {
  group: string | null;        // "alpha", "beta", "gamma", etc.
  blueLocation: string | null; // compass: "s", "n", "ne", etc.
  redLocation: string | null;  // compass: "n", "s", "sw", etc.
  gridMode: "box" | "diamond" | "mixed"; // derived from locations
}
```

The existing `deriveStartPositionGroup` already reads `blueLoc` and `redLoc` at lines 225-226 of `card-back-data.ts`. Refactor to capture and return these values alongside the group string.

Update `CardBackData.startPositionGroup` to `CardBackData.startPosition: StartPositionInfo | null`.

**Rendering:** An inline SVG in CardBackV5.svelte. No external image files needed. The SVG draws:
1. Small outline circles at each grid point position (4 for box/diamond, 8 for mixed)
2. A filled blue circle at the blue hand's starting location
3. A filled red circle at the red hand's starting location
4. A faint center dot to anchor the grid visually

Grid point positions in the SVG viewbox (e.g., 40x40):

| Position | Box (cardinal) | Diamond (intercardinal) |
|----------|---------------|------------------------|
| N / NE   | (20, 4)       | (36, 4)                |
| E / SE   | (36, 20)      | (36, 36)               |
| S / SW   | (20, 36)      | (4, 36)                |
| W / NW   | (4, 20)       | (4, 4)                 |

## Implementation Order

1. **Change 1 (Start Row)** first — experimental, user wants to see it before committing. Quick to try, easy to revert.
2. **Change 3 (Mini-Grid)** second — independent of the other changes, valuable on its own.
3. **Change 2 (Print Layout)** third — builds on whichever front layout approach survives from Change 1.

## Out of Scope

- Changes to the card back corner layout (level, LOOP, steps positions stay as-is)
- Changes to how the tight image looks in browse/viewer/export (other than start-as-row)
- Level badge redundancy between front and back (noted as a future consideration)
- Hand path arrows on cards (separate project)
- Skewed grid mode in mini-grid (Level 4+, future enhancement)
