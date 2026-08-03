# Auto Layout: Prefer Full Grids Over Bigger-But-Gappy — Design

**Date:** 2026-07-10
**Status:** Approved (design)
**Scope:** `src/lib/shared/render/services/container-aware-layout.ts` (interactive "Auto" ChoreoCard layout only)

## Problem

The container-aware "Auto" layout picks the columns×rows that renders the
ChoreoCard largest in its live container. It scores candidates by cell-edge size
(bigger = better), treating the number of empty cells as a distant tie-breaker
consulted only when two shapes render within 0.5px of each other.

Result: for an 8-count sequence with the start position + QR, Auto chose a
`sc=3` column layout — a 4×3 grid with **3 empty cells** (the QR slot plus two
visible gaps) — because it rendered marginally bigger cells than the full
alternatives. The empty cells sit in the corner of the grid as awkward dead
space. Austen (2026-07-10): the auto mode should only pick column counts within
"a set of acceptable parameters for that specific step count ... so it doesn't
create this upward space."

### Measured, for 8 steps + start + QR

The start position is not a plain grid cell — it owns a full row (row
placement) or a full column (column placement). So a tidy 3×3 of 9 cells is not
representable; the real candidates are:

| shape | grid | empty cells | note |
|---|---|---|---|
| `sc=3`, column (what Auto picked) | 4×3 = 12 | **3** | QR slot + 2 visible gaps |
| `sc=4`, column | 5×2 = 10 | 1 | just the QR slot, zero visible gaps |
| `sc=2`, row | 2×5 = 10 | 1 | zero visible gaps |

The clean shapes waste one cell (the reserved QR slot); the picked shape wastes
three. Auto preferred it purely on render size.

## Rejected approach: strict perfect-tiling filter

The obvious reading of "acceptable parameters" is: only allow step-column counts
that divide the step count evenly (`stepCount % stepCols === 0`). This breaks on
primes and awkward counts. For 7 steps the only clean divisors are `sc ∈ {1, 7}`,
forcing Auto into a 1-wide strip or a 7-wide row — strictly worse than today. A
hard divisor filter is out.

## Rejected approach: fewest-empty-cells primary

The first attempt made `wasted` the primary objective (fewest gaps wins, size
only a tie-breaker). It fixed the 8-count but **over-corrected**: for a 12-count
+ start + QR in a tall container it picked the *skinniest* full grid — a 2-wide
2×7 (wasted 1) — over the container-filling 4×4 (the shape the deterministic
table and the card-download preview both use). Pure fewest-waste ignores how
small/skinny the winner renders. Symmetric failure to pure-size: one leaves
corner gaps, the other leaves horizontal dead space around a tiny card.

## Rejected approach: fewest-empty-cells + slack

"Allow at most `k` more gaps than the fullest shape, then maximize size." With
`k = 1` it fixes the 8-count (5×2) but the 12-count's fullest shape is the skinny
2×7 (wasted 1), so `k = 1` caps the pool at wasted ≤ 2 and excludes the
container-filling 4×4 (wasted 3) — giving a 4-wide `5×3` instead of the table's
4×4. Raising to `k = 2` re-admits the 8-count's 3-gap 4×3. The slack `k` is in
the same 8-vs-12 tension as a raw primary flip: it can't weigh *how much* bigger
a gappy shape renders.

## Design: gap-penalized size

`pickBestFitLayout` enumerates every valid `(stepCols, placement)` candidate and
computes, per candidate, its rendered `cellEdge`, `wasted` cell count
(`cols * rows - usedCells`), and `balance` (`|cols - rows|`). Pick the candidate
that maximizes a **gap-penalized score**:

```
bestEdge = max(cellEdge over all candidates)
score    = cellEdge - GAP_PENALTY_FRACTION * bestEdge * wasted
```

Ties (within `CELL_EDGE_EPSILON`) break on raw `cellEdge`, then on `balance`.

Each empty cell docks a fixed fraction of the *biggest achievable* cell edge, so
the penalty is scale-invariant (independent of container pixel size). A shape
with an extra gap must render at least `GAP_PENALTY_FRACTION * bestEdge` bigger
per gap to win. This is exactly the missing degree of freedom: it weighs the
size gain of a gappy shape against its gaps, instead of ranking size and gaps
lexically.

### The priced gap is a step-region gap, not any empty cell

A third real case forced a refinement. In a **portrait** viewer panel (~0.71),
an 8-count + start + QR picked a 2×5 with the start + QR on a top row. The wider
3×4 start-**column** renders bigger and fills the panel, but pricing *total*
`wasted` cells rejected it: its start column carries two structural holes (start
at top, QR at bottom, mandala lane between), counting as 2 gaps.

Those holes are not the defect. The defect Austen flagged is a gap in the **step
region** — an unfilled last step row (the "upward space"). The start's own lane
(the full row under row-placement, the full column under column-placement) is
where the mandala lives; its leftover cells read as structural, not awkward.

So the priced quantity is `stepTrailing` — empty cells in the step grid only:

```
stepCols = (column placement) ? cols - 1 : cols       // start owns col 1
stepRows = (row placement)    ? rows - 1 : rows        // start owns row 1
stepTrailing = stepCols * stepRows - stepCount
score = cellEdge - GAP_PENALTY_FRACTION * bestEdge * stepTrailing
```

Total `wasted` (incl. start-lane holes) drops to a tiebreak below cell edge, so
two equal-size, equal-step-gap shapes prefer fewer holes but a shape is never
rejected for a structural start-lane hole.

`GAP_PENALTY_FRACTION = 0.12`. The usable band is ~0.10–0.15. Results across the
three real cases and robustness checks:

- **8 + start + QR** (~0.71 portrait): **3×4 start-column** — full step region,
  fills the panel width. (The 4×3 with a step-region gap is rejected.)
- **12 + start + QR** (~0.95): **4×4** — matches the card-download preview.
- **12 + start + QR** (~0.64 tall): **3×5** — 3 step columns, taller.
- **7** (prime): a real 3×4/2×5 shape, never a 1-wide strip.
- **8 no start** (square): **3×3** (one trailing gap, near-square) over the
  wider full 4×2 — a near-square fills a square container better.

### Why this is prime-safe

`score` is defined for every candidate; nothing is ever excluded, so a valid
shape always wins. For 7 steps + start + QR the winner is a 2×5 (one trailing
empty), never a 1-wide strip.

### Behavior (confirmed by Austen)

Auto now matches the deterministic table's proportions far more closely — the
interactive viewer and the card-download preview pick the same sensible grid
shape for the same sequence, instead of the viewer chasing raw size into
gappy or skinny layouts.

## Non-goals / unchanged

- **Export / print / gallery thumbnails** have no live container, receive `null`
  from the Auto seam, and stay on the deterministic static table
  (`layout-calculator.ts`). Untouched.
- **Manual column override**, **per-length composition override**, **mixed
  durations**, and **long scroll sequences** all short-circuit before
  `pickBestFitLayout` in `choreo-card-layout-state.svelte.ts`. Untouched.
- The QR-reservation guards (`continue` when a required QR slot can't be parked)
  are unchanged.
- Start placement selection (`row` vs `column`) still flows from the chosen
  candidate's `startPlacement`.

## Testing

New unit test `container-aware-layout.test.ts` for `pickBestFitLayout`:

1. **8 + start + QR** → returned grid has `cols * rows - 9 <= 1` (only the QR
   slot may be empty); asserts it is NOT the 4×3 shape.
2. **7 + start + QR** → returns a full-as-possible shape (min wasted among valid
   candidates), NOT a 1-wide strip.
3. **8, no start, no QR** → prefers a fully-tiling shape (0 wasted) for at least
   one representative container aspect.
4. **Size still matters among equally-full shapes** — with two full candidates
   (e.g. 5×2 vs 2×5 for 8+start), the one that renders the larger cell in the
   given container width/height wins.
5. **Degenerate inputs** unchanged: `stepCount < 1` → `null`; non-positive
   container dims → `null`.

Verification: `npm run check` clean + the new test green. Interactive spot-check
of the 8-count case in the sequence viewer (no corner gap).
