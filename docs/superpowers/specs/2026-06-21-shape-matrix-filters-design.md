# Shape Matrix Filters — Design

**Date:** 2026-06-21
**Status:** Approved (build)
**Origin:** The Shape Matrix lab (`/test/shape-matrix`) renders a 28×28 = 784-cell grid — too dense to scan. Add per-axis filtering + redundancy collapse to make it tractable.

## Goal

Shrink what the grid shows, on demand, without recomputing any flowers.

## Controls

**One compact single-row toolbar** (~64px), two color-coded per-axis groups (blue rows, red cols), independent:
- **Style** — `SegmentedControl` (width-constrained ~132px): All / Pro / Anti. Blue=Pro + Red=Anti isolates the Pro×Anti quadrant.
- **Turns** — 7 small (26px) dense numeric toggle buttons (0 … 3), multi-select, all on by default, tinted per axis.
- **Orientation** — `SegmentedControl` (~118px): All / In / Out.

**Collapse twins** — one small toggle, default ON. Even-petal flowers render identically for `in`/`out`, so collapse keeps only their `in` entry; odd-petal flowers keep both (they differ up/down). 784 → 400 by default.

**Density note (why the turn/collapse toggles are not `FilterChipBase`):** `FilterChipBase` enforces a 44px touch-target floor and a full-pill shape — correct for touch filter rows, too bulky for a dense 7-value numeric selector on a 4K desktop lab (a first attempt with it produced an unusable 440px-tall wall of giant buttons). Turns/collapse use small purpose-built toggles, the same reason the codebase keeps `BpmChips` / `MotionColorChips` separate (chip-primitives.md "Keep-Separate"). Style/orientation correctly use the shared `SegmentedControl`, width-constrained (it is `width:100%` by default).

**Live cell count** in the header — `rowAxis.length × colAxis.length`, updates as filters change.

## Engine (pure, no re-render)

All 28 blue + 28 red `MandalaPaths` are computed once at load (unchanged). Filtering only selects which axis entries display:

```
rowAxis = applyFilter(fullAxis, filters.blue, collapse)
colAxis = applyFilter(fullAxis, filters.red, collapse)
```

`applyFilter(axis, f, collapse)` keeps a flower when:
- `f.style === "all" || flower.style === f.style`, AND
- `f.turns.has(flower.turns)`, AND
- `f.ori === "all" || flower.ori === f.ori`, AND
- `!collapse || flower.petals % 2 === 1 || flower.ori === "in"` (collapse drops even-petal `out` twins).

The grid renders cells lazily, so a smaller axis = fewer cells instantly.

## Types

```ts
export interface AxisFilter {
  style: "all" | "pro" | "anti";
  turns: ReadonlySet<number>;
  ori: "all" | "in" | "out";
}
export interface MatrixFilters {
  blue: AxisFilter;
  red: AxisFilter;
  collapse: boolean;
}
```

Default: `style:"all"`, `turns: all 7`, `ori:"all"`, `collapse:true`.

## Components

- **New** `src/lib/features/lab/vtg-lab/domain/filter-flower-axis.ts` — pure `applyFilter` + `defaultMatrixFilters()`. Unit-tested.
- **New** `src/lib/features/lab/vtg-lab/components/ShapeMatrixFilters.svelte` — the two bars + collapse toggle; emits `MatrixFilters`. Uses `SegmentedControl` + `FilterChipBase` (chip-primitives rule; no checkboxes).
- **Modify** `ShapeMatrixGrid.svelte` — accept `rowAxis: Flower[]` and `colAxis: Flower[]` props instead of reading `data.axis` directly.
- **Modify** `routes/test/shape-matrix/+page.svelte` — hold filter state, derive `rowAxis`/`colAxis`, render the filter bar + count.

## Edge cases

- **Empty result** (all turns off, or a style with no matching turns): grid shows a "no flowers match" placeholder; count reads `0 cells`.
- **Collapse + Orientation=Out:** even-petal flowers have no unique `out`, so they drop out (only odd-petal `out` shown). Intended — `out` even-petal IS the duplicate. Default `ori=all` avoids surprise.

## Reuse (never-hand-roll, verified)

- `SegmentedControl` (`lib/shared/3d/components/controls/SegmentedControl.svelte`) — props `{ options:{value,label,count?}[], value, onchange, color?, size? }`.
- `FilterChipBase` (`lib/shared/browse/components/filter-chips/FilterChipBase.svelte`) — props `{ label, active, mode:"toggle", size, onclick }`.

## Out of scope

Transpose-symmetry collapse (upper-triangle): NOT done — (blue X, red Y) ≠ (blue Y, red X) because the blue/red color assignment is meaningful. Quadrant tabs, focus/sweep mode, hover-zoom: separate (the "navigate" approach), not this pass.
