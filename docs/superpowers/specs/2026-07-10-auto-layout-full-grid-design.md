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

## Design: flip the scoring objective

`pickBestFitLayout` already enumerates every valid `(stepCols, placement)`
candidate and computes, per candidate, both its rendered `cellEdge` and its
`wasted` cell count (`cols * rows - usedCells`). The only change is the
**comparison order** in `isBetter`:

1. **Primary — fewest empty cells** (`wasted`, smaller wins). The fullest grid
   always wins.
2. **Secondary — largest cell edge** (`cellEdge`, bigger wins, within the
   existing 0.5px epsilon for float/stability noise). Among equally-full shapes,
   render the biggest.
3. **Tertiary — best balance** (`|cols - rows|`, smaller wins). Closest to
   square breaks remaining ties.

No divisor math, no per-count whitelist, no new state. `wasted` is already the
right gap metric: it counts the reserved QR cell uniformly across all start+QR
candidates (an ordering-neutral constant offset), and every genuinely-empty
non-QR cell adds to it.

### Why this is prime-safe

`wasted` is defined for every candidate, so the primary objective is always
satisfiable. For 7 steps + start + QR the least-wasteful real shape is `sc=4`
column (5×2 = 10 cells, one trailing empty in the last step row) — Auto now picks
that instead of a strip. No candidate is ever excluded; the ordering simply
prefers full grids.

### Behavior change to confirm (confirmed by Austen)

In a container whose aspect strongly favors a gappy shape, Auto will now pick a
**slightly smaller but full** card rather than a bigger card with corner gaps.
This is the intended trade: no upward/corner dead space, even at a small size
cost.

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
