# Container-Aware Auto Card Layout — Design

**Date:** 2026-07-07
**Status:** Approved (brainstorm complete, full-scope go-ahead)
**Area:** `src/lib/shared/render/services/`, `src/lib/shared/choreo-card/state/`, `ChoreoCard.svelte`

## Problem

The ChoreoCard "Auto" column layout is **container-blind**. `calculateLayout(stepCount, includeStart, startLayout)` is a static lookup table keyed on step count alone. It emits the same cols×rows whether the card sits in a wide-short pane (sequence-viewer side-by-side bottom) or a narrow-tall pane (side-by-side right). So "Auto" can never honor "make the card as big as possible in this container" — it has no idea a container exists.

Reported symptom: a scanned 4-count card rendered as a 1-row strip (4 step columns + start column) in side-by-side view. That exact shape comes from a stale `columnCountOverride` of 4 (column start mode), not from Auto — but it exposed that Auto itself is the wrong abstraction. Fixing Auto to be container-aware makes the whole system behave under all pane geometries.

## Decisions (from brainstorm)

- **Fit strategy:** pure best-fit — pick the cols×rows whose card shape best matches the container so cells render largest. No balance bias, no strip guard beyond what geometry dictates.
- **Start placement:** Auto also chooses start row-vs-column for best fit. While on Auto, the explicit row/column start setting is inert (Auto decides). The setting still applies when a fixed column count is chosen.
- **Scope:** container-aware Auto applies to **live-rendered cards** (interactive viewer). Export / print / gallery-thumbnail keep the deterministic table — no live container, needs reproducible baked aspect ratios.
- **Long sequences (>16 steps, scrolling):** included ("all in"). Scroll cards get a **width-adaptive** column count instead of the hardcoded 5. Export/forceContain long sequences keep 5 (deterministic).
- **Cleanup:** `renderAllCells` de-duplicated to read the factory's resolved dims (single source of truth), matching `relayoutCells`.

## Non-goals

- Touching export/print/thumbnail/gallery layout math (`calculateGalleryAspectRatio`, `calculateThumbnailAspectRatio`, `calculateImageDimensions`).
- Mixed-duration (timeline) cards — those size columns from content, not a free choice. Auto best-fit is gated to uniform grids.
- Explicit column overrides (2/4/6/8) — unchanged; Auto is only the `null` case.
- Explicit hysteresis state. Container dims change discretely (panes are fixed fractions; grid-template transitions are deliberately disabled to avoid ResizeObserver cascades), so there is no continuous oscillation source. A float-epsilon tie test in the picker gives mild stability. If flicker appears in testing, add a deadband then.

## Architecture

### New pure module: `src/lib/shared/render/services/container-aware-layout.ts`

No DOM, fully unit-testable. Two exports.

```ts
export type StartPlacement = "row" | "column" | "none";

export interface FitLayout {
  cols: number;            // total grid columns (incl. start column in column placement)
  rows: number;            // total grid rows (incl. start row in row placement)
  startPlacement: StartPlacement;
}

export function pickBestFitLayout(input: {
  stepCount: number;
  includeStartPosition: boolean;
  containerWidth: number;   // raw px
  containerHeight: number;  // raw px
  showHeader: boolean;
  showFooter: boolean;
  showQRCode: boolean;      // QR needs a reserved empty info cell → constrains candidates
}): FitLayout | null;       // null when dims <= 0 or stepCount < 1 → caller falls back to table

export function pickScrollColumns(
  containerWidth: number,
  opts?: { min?: number; max?: number; targetCellPx?: number },
): number;                  // clamp(round(w / targetCellPx), min, max); 5 when width unknown
```

**Grid-shape formula** (mirrors `renderAllCells` / `calculateGridPosition` exactly, so positions never disagree):

- no start: `totalCols = sc`, `totalRows = ceil(stepCount / sc)`
- row placement: `totalCols = sc`, `totalRows = 1 + ceil(stepCount / sc)`
- column placement: `totalCols = sc + 1`, `firstRow = min(sc, stepCount)`, `totalRows = 1 + ceil((stepCount - firstRow) / sc)`

where `sc` = candidate step-column count ∈ `[1..stepCount]`.

**Objective (best cellEdge):** cells are square, so max cell edge = max card area.

```
headerFrac = showHeader ? (1/HEADER_HEIGHT_DIVISOR) * hfScale : 0
footerFrac = showFooter ? (1/FOOTER_HEIGHT_DIVISOR) * hfScale : 0
hfScale    = totalCols >= 3 ? 1 : totalCols / 3
cardHeightInCells = totalRows + headerFrac + footerFrac
cellEdge   = min(containerWidth / totalCols, containerHeight / cardHeightInCells)
```

This reuses the **same** header/footer-fraction math as the factory's `previewAspectRatio`, keeping one formula. `HEADER_HEIGHT_DIVISOR` / `FOOTER_HEIGHT_DIVISOR` imported from `@tka/render-composition`.

**Candidate filter:** when `showQRCode && includeStartPosition`, the layout must reserve a slot for the QR (functional, not decorative):

- row placement requires `totalCols >= 2` (QR sits at `(cols, 1)`, must differ from start `(1,1)`)
- column placement requires `totalRows >= 2` (QR sits at `(1, rows)`)

Candidates failing the filter are skipped. Mandala fills are decorative (fill leftover empty cells) and impose no filter.

**Selection:** maximize `cellEdge` (compared with a small epsilon so float ties are real ties), then tie-break by fewest wasted cells (`totalCols*totalRows - usedCells`), then by most-balanced (`abs(totalCols - totalRows)` asc).

### Wiring: `choreo-card-layout-state.svelte.ts`

Add two deps: `containerWidth`, `containerHeight` (raw px).

New derived `autoFit` — returns a `FitLayout` when **all** hold, else `null`:

- `stepCount >= 1`
- `!hasMixedDurations` (uniform grids only)
- `columnCount === null` (no per-instance override)
- no composition override for this step count (4+)
- `!isLongSequence` (scroll path handled separately)
- `containerWidth > 0 && containerHeight > 0` (else table fallback until measured)

Then:

- `startPositionLayout` → `autoFit.startPlacement` when `autoFit && includeStartPosition`, else existing composition logic.
- `baseColumns` → `autoFit.cols` when `autoFit`, else existing logic — with the long-sequence branch changed to `needsScroll && containerWidth > 0 ? pickScrollColumns(containerWidth) : 5`.
- `baseRows` → `autoFit.rows` when `autoFit`, else existing logic (already derives rows from cols for the long/override branches, so width-adaptive scroll cols flow through unchanged).

No cycle: `autoFit` reads deps + `isLongSequence` + composition manager (never reads `startPositionLayout`/`baseColumns`). `startPositionLayout`/`baseColumns`/`baseRows` read `autoFit` and short-circuit before touching each other.

### Wiring: `ChoreoCard.svelte`

- New state `containerRawWidth` / `containerRawHeight`.
- `captureContainerDims()` reads `containerElement.clientWidth/Height` (root has no padding → usable dims). Called from the container ResizeObserver, and once at the top of `onMount` (before the synchronous cache probe) so best-fit is active from first paint.
- Pass `containerWidth: containerRawWidth`, `containerHeight: containerRawHeight` into `createChoreoCardLayoutState`.
- **Cleanup (§5):** `renderAllCells` drops its duplicated cols/rows resolution block and reads `cols = effectiveColumns`, `rws = effectiveRows` (set `hasMixedDurations` first so the factory resolves the mixed vs uniform branch, then read the derived). The mixed-duration branch keeps its own `computedDurationRows`/`rws`/`durationColCount` recompute (unchanged), now fed by `cols = effectiveColumns`. This makes `renderAllCells` match `relayoutCells`, which already reads the factory dims.

### Runtime flow

Container resize → `containerRawWidth/Height` change → `autoFit` recomputes → `effectiveColumns/Rows` change → the render `$effect` classifies it **layout-only** → `relayoutCells()` (grid positions only, **no image re-render** — cells are square, cached by content). Cheap.

## Data flow (one direction, no feedback)

```
containerElement.clientWidth/Height  (parent-driven, independent of grid)
        │  captureContainerDims()
        ▼
containerRawWidth / containerRawHeight  ($state)
        │  layoutState deps
        ▼
autoFit → baseColumns/baseRows/startPositionLayout → effectiveColumns/Rows
        │
        ▼
previewAspectRatio → updateContainedDimensions() → containedWidth/Height (visual box only)
```

Feeding **raw** container dims (not the aspect-fitted `containedWidth/Height`, which depend on cols) is what prevents a cycle.

## Testing

Unit tests on the pure module (`tests/unit/container-aware-layout.test.ts`):

1. 4-count, tall/narrow container → 2 step columns (row placement), not a strip.
2. 4-count, wide/short container → wide grid (4-across / strip), max cellEdge.
3. 4-count, ~square container → balanced (2×2-ish).
4. Aspect sweep: as container goes tall→wide, chosen `cols` is monotonically non-decreasing.
5. `showQRCode` filter: never returns a layout with no QR slot (row cols<2 / column rows<2).
6. `includeStartPosition = false` path uses the no-start shape formula.
7. Invalid inputs (dims 0, stepCount 0) → `null`.
8. Grid-shape formula parity: for representative (stepCount, sc, placement) the returned cols/rows match the `renderAllCells`/`calculateGridPosition` convention.
9. `pickScrollColumns`: 5 at unknown width; scales with width; clamped to [min,max].

No component/browser test — the pure function holds all the logic (per component-test-discipline: test-on-fix, don't widen the browser layer). Runtime verified by build + typecheck + the author driving the viewer.

## Files

- **Create:** `src/lib/shared/render/services/container-aware-layout.ts` — grep found no existing container-aware / best-fit layout picker; `layout-calculator.ts` is the static-table sibling this complements.
- **Create:** `tests/unit/container-aware-layout.test.ts`
- **Edit:** `src/lib/shared/choreo-card/state/choreo-card-layout-state.svelte.ts`
- **Edit:** `src/lib/shared/sequence-viewer/components/ChoreoCard.svelte`
