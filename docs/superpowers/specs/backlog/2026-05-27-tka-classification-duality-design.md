---
status: backlog
value: 2
effort: L
remaining: "Body status: Draft"
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-07-25
---
# TKA Classification Axes & Duality

**Date:** 2026-05-27
**Status:** Draft
**Scope:** Document the proven independent classification axes in TKA's sequence space, the hand-vs-prop duality observation, and an interactive pivot-table explorer for browsing sequences by any axis combination.

---

## Problem

TKA sequences are currently browsed by one axis at a time: pick a TnD family, then a turn level, then scroll. But sequences sit at the intersection of multiple independent classification axes (timing, direction, turn ratio, reversal pattern, prop orientation). There's no tool that lets you pivot between axes, no documentation of which axes are proven independent, and no way to explore the prop-centric classification that mirrors the hand-centric one.

---

## What's Proven

### Axis independence (computational proof, 2026-05-27)

All 19 VTG base sequences were analyzed by unmapping prop orientations (in/out/clock/counter) to absolute spatial directions (up/down/left/right) using the position-dependent lookup tables in `DirectionMaps.ts` and `poi-gravity-orientation-deriver.ts`.

**Result:** The prop absolute orientation relationship between two performers is **independent** of their hand TnD family.

Evidence — every hand family contains sequences with multiple prop orientation relationships:

| Hand family | Prop orientation relationships found |
|-------------|--------------------------------------|
| split-same | perpendicular, opposite, same |
| split-opp | perpendicular, same, opposite |
| tog-same | opposite, same |
| tog-opp | same, opposite |

This means prop timing/direction cannot be derived from hand timing/direction. They are genuinely independent classification axes.

### The six known axes

| # | Axis | Values | Source |
|---|------|--------|--------|
| 1 | Hand timing | split, together, quarter | `vtg-terminology-mapper.ts` — `startLocation` match |
| 2 | Hand direction | same, opposite | `vtg-terminology-mapper.ts` — `rotationDirection` match |
| 3 | Prop orientation relationship | same, opposite, perpendicular | `DirectionMaps.ts` unmapping to absolute directions |
| 4 | Turn ratio | 7 blue × 7 red = 49 cells | `Catalog.turnPattern` in Firestore |
| 5 | Reversal pattern | 15 named patterns across 4 families | `reversal-patterns.ts` |
| 6 | Hand path continuity | continuous, reversing | Future axis — breaks TnD's "continuous hand" constraint |

Axes 1-3 are proven independent of each other. Axes 4-5 are independent by construction (turn ratio and reversal pattern are chosen freely per deck). Axis 6 is defined but not yet enumerated.

### What this is, honestly

A multi-factor enumeration. Each sequence has a value on each axis. The axes are categorical variables whose cross-product defines the full sequence space. This is a spreadsheet with multiple columns, not a geometric object. The "duality" between hand-centric and prop-centric classification is an observation about symmetry in the enumeration, not a proven mathematical duality in the formal sense.

---

## What's Conjectured (Open Research)

### Prop-centric classification

The current system classifies by hand timing and hand direction (TnD families). The same classification logic could be applied to props: do the props arrive at the same position? Do they rotate the same direction?

Open questions:

1. **Does the quarter timing category apply to props?** Hands have split (180 apart), together (same position), and quarter (90 apart). Props don't occupy grid positions the same way — what does "quarter" mean for prop orientation?

2. **How does "perpendicular" map to flow arts vocabulary?** The third prop orientation relationship (perpendicular) appears when hands are at 90-degree grid positions with radial orientations. Is there an existing name for this in the community?

3. **Does prop orientation relationship change over a multi-turn motion?** The independence proof used base sequences (0 additional turns). With turns > 0, props rotate through multiple orientations per step. Does the relationship at the start of the step define the category, or is it the relationship across the full motion arc?

4. **Is the hand-prop duality symmetric?** If you swap the classification roles (classify by prop relationship, treat hand relationship as a variable), do you get the same number of families? The same independence structure? This is testable but not yet tested.

### Full enumeration size

The naive cross-product of all axes gives a very large number. But most cells are empty — not every combination of axis values produces a physically realizable sequence. The actual population is bounded by:

- Step count compatibility (reversal pattern period must divide step count)
- Physical reachability (not all turn ratios work at all grid positions)
- LOOP boundary parity (only 25% of arbitrary reversal combinations produce clean loops)

Mapping which cells are populated vs empty is itself a research project.

---

## Current Catalog Inventory

As of 2026-05-27:

| Collection | Catalogs | Sequences | Coverage |
|------------|----------|-----------|----------|
| TnD | 84 | 1,596 | 42 symmetric turns × 6 reversals + 42 asymmetric turns × continuous only |
| LOOP | 5 | 31,766 | Rotated only, halved + quartered, continuous only |
| **Total** | **89** | **33,362** | |

Full TnD matrix would be 294 catalogs (49 turn combos × 6 reversal patterns). Missing: 210 asymmetric turn pairs × 5 non-continuous reversal patterns.

---

## Playground Design: Pivot Table Explorer

An interactive HTML file that lets users pick any two classification axes as the matrix rows and columns, with remaining axes as filter toggles.

### Controls (left panel)

- **Row axis** dropdown: hand timing, hand direction, prop orientation, turn level (blue), turn level (red), reversal family
- **Column axis** dropdown: same options, excluding whatever is selected as row
- **Filter toggles** for each remaining axis: toggle buttons to include/exclude specific values

### Preview (right panel)

A matrix grid where:
- Row/column headers are the values of the selected axes
- Each cell shows the count of sequences matching that combination (after filters)
- Cells are heat-mapped by count (darker = more sequences)
- Click a cell to see the list of sequences in it

### Presets

| Preset | Row axis | Column axis | Description |
|--------|----------|-------------|-------------|
| Turn Matrix | Blue turns | Red turns | The existing 7×7 turn grid |
| Family × Reversal | TnD family | Reversal pattern | Which families have which reversal patterns |
| Hand × Prop | Hand TnD family | Prop orientation | The independence proof visualized |
| Reversal × Turns | Reversal family | Turn level | Reversal pattern distribution across turn levels |

### Data source

The playground loads sequence data from a static JSON export of the catalog. Each entry needs:

```typescript
interface PivotEntry {
  id: string;
  handTiming: 'split' | 'together' | 'quarter';
  handDirection: 'same' | 'opposite';
  propOrientation: 'same' | 'opposite' | 'perpendicular';
  blueTurns: number;
  redTurns: number;
  reversalPattern: string;
  reversalFamily: string;
  catalogId: string;
  stepCount: number;
}
```

For the initial playground, this data can be generated from the 19 VTG base sequences × turn combinations × reversal patterns. Prop orientation requires the `DirectionMaps.ts` unmapping computation.

### Prompt output

The prompt at the bottom generates a natural-language description of the current view:

> "Showing 84 TnD sequences grouped by hand family (rows) × reversal pattern (columns). Filtered to: symmetric turns only, continuous hand path. 3 cells empty (quarter-same × solo patterns have no sequences at this turn level)."

---

## Reversal Pattern Browser

A separate but related feature for the catalog browser: filter catalogs by reversal pattern.

### Location

New filter chip row in `CatalogBrowseFilterBar.svelte`, visible when the TnD collection is selected.

### Behavior

- Shows reversal pattern names as filter chips: Continuous, Book, Red Book, Blue Book, Long Book, Alternating, Solo 1-3, Dense Weave 1-3, Sparse Weave 1-3
- Grouped by family with visual separators
- Multi-select: user can select multiple patterns
- Selected patterns filter the catalog grid to show only catalogs with matching `reversalPattern`
- Default: all patterns selected (no filter)

### Data

`CatalogBrowseFilterBar` already reads `reversalPattern` from catalog metadata. The filter chips wire into the existing `applyFilters()` pipeline in `catalog-browse-state.svelte.ts`.

---

## Implementation Notes

### Prop orientation computation

To populate the pivot table with prop orientation data, we need a function that:

1. Takes a sequence's step data (two motions with positions and orientations)
2. Uses `DirectionMaps.ts` to convert relative orientations to absolute directions
3. Compares the two absolute directions to produce same/opposite/perpendicular

This function exists conceptually in the proof analysis but not as a reusable utility. Implementation should extract it into `src/lib/features/choreo-card/domain/prop-orientation-classifier.ts`.

### Existing code to reuse

| Need | Existing code |
|------|--------------|
| Hand timing/direction | `vtg-terminology-mapper.ts` — `deriveVTGTerminology()` |
| Orientation unmapping | `DirectionMaps.ts` — position×orientation lookup tables |
| Reversal pattern defs | `reversal-patterns.ts` — `REVERSAL_PATTERNS` array |
| Catalog metadata | `Catalog.ts` interface + Firestore `decks` collection |
| Filter pipeline | `catalog-browse-state.svelte.ts` — `applyFilters()` |

### Scope boundaries

- The pivot table playground is a standalone HTML file, not integrated into the app
- The reversal pattern browser IS integrated into the app (catalog filter bar)
- Prop orientation classification is a new utility but reuses existing lookup tables
- No changes to Firestore schema — all classification data is derived at runtime

---

## Success Criteria

1. Spec documents all proven axes with evidence, clearly separating proven from conjectured
2. Playground renders a working pivot table with at least the 19 base sequences × 6 reversal patterns
3. Reversal pattern filter chips appear in the catalog browser when TnD collection is selected
4. Prop orientation classifier produces correct same/opposite/perpendicular for all 19 base sequences (validated against the manual proof from 2026-05-27)
