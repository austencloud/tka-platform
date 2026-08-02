---
status: backlog
value: 3
effort: M
remaining: "Body status: Draft"
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-07-25
---
# Half-Step Midpoints

**Date:** 2026-05-27
**Status:** Draft
**Related:** [Dyads spec](./2026-05-27-dyads-fused-pictographs-design.md)

## Summary

Every letter's motion has a deterministic halfway point. Map those midpoints, and any sequence can display at 2x granularity — a 4-step sequence shows 8 half-steps, each a real pictograph showing where props actually are mid-motion. This is a view-layer feature, not a data transformation. The same sequence object underlies all granularity levels.

## Motivation

Sequences with high turn counts (2+ turns per beat) pack too much motion into a single pictograph. The arrow conveys "2 turns CW" but the viewer can't see where the prop actually is halfway through that motion. Half-steps solve this by splitting each beat at its midpoint, revealing the intermediate state that was previously hidden inside the arrow.

## Killed Approach

Mandala-path arrows (using computed tip trajectories as arrow shapes) were prototyped and rejected — the paths don't read well as arrows at pictograph scale. Half-steps use the existing representational arrow system instead.

## Data Model

### Midpoint Resolution

Every motion has a geometric midpoint at t=0.5 through its interpolation path:
- **Pro (arc):** t=0.5 on the radial arc. Pro N→S CW = E. Pro N→S CCW = W.
- **Anti (concave):** t=0.5 on the reflected-arc path.
- **Dash (linear):** t=0.5 = geometric midpoint of the straight line. Often center.
- **Static:** Same position (hand doesn't move). Midpoint = start = end.
- **Float:** t=0.5 on the arc, but staff maintains absolute angle.

### Grid Snapping

Midpoints snap to the nearest of the 9 standard grid positions (8 compass points + center). Rationale: the existing arrow system, pictograph renderer, and entire position vocabulary are built on this grid. Sub-grid positions would require new arrows, new rendering logic, and new domain vocabulary for marginal accuracy gain.

### Midpoint Correction Table

Algorithmic midpoints from the geometry calculator (sample at t=0.5) provide the base dataset. A manually curated correction table overrides any midpoints that snap incorrectly. Structure:

```typescript
interface MidpointCorrection {
  letter: string;
  startPosition: GridPosition;
  correctedMidpoint: GridPosition;
}
```

The correction table is sparse — only entries where the algorithmic snap is wrong. Populated through a mapping session: algorithmic base → Austen reviews → corrections filed.

### Half-Step Decomposition

Each beat decomposes into two half-steps:

| | Half A (first half) | Half B (second half) |
|---|---|---|
| Start position | Beat's start position | Resolved midpoint |
| End position | Resolved midpoint | Beat's end position |
| Turns | Half the beat's turns | Remaining half |
| Motion type | Same as beat | Same as beat |
| Rotation direction | Same as beat | Same as beat |

Example: Pro 1 turn CW, N→S
- Half A: Pro 0.5t CW, N→E
- Half B: Pro 0.5t CW, E→S

### Arrow Coverage

Half-step motions are smaller versions of existing motions. The current arrow system covers:
- 0, 0.5, 1, 1.5, 2, 2.5, 3 turns
- All motion types at each turn count
- All position pairs

Half-steps mostly decompose into 0.5-turn or lower motions — already covered by existing glyphs. Gap analysis needed during implementation to identify any missing arrow variants.

## Viewer Integration

### Granularity Toggle

Sequence viewer gains a granularity control (shared with dyads):

```
Dyad (0.5x) ← Normal (1x) → Half-step (2x)
```

When half-step mode is active:
1. Each beat's motion is decomposed into two half-steps using the midpoint table
2. Two pictographs rendered per original beat, labeled with sub-step indicators (e.g., "1a", "1b")
3. Playback, scrubbing, navigation all operate at half-step granularity
4. Beat count display shows original count with "(half-step view)" indicator

### Rendering Pipeline

```
SequenceData (unchanged)
  → GranularityAdapter (splits beats at midpoints)
    → PictographData[] (2x length)
      → Standard PictographRenderer (unchanged)
```

The GranularityAdapter is the only new component. PictographRenderer and arrow positioning work unchanged because half-steps produce standard PictographData with standard grid positions.

### No New Sequence Objects

Half-step view is derived on the fly. No storage, no export, no separate sequence identity. Toggle off → back to normal view instantly.

## Data Gathering Workflow

1. **Algorithmic pass:** Run geometry calculator at t=0.5 for every letter from every grid position. Snap to nearest grid point. Output: base midpoint table.
2. **Review session:** Austen reviews the table, corrects snapping errors. Output: correction table overlay.
3. **Merge:** Base table + corrections = authoritative midpoint map.
4. **Storage:** JSON file in the codebase. Loaded at startup. Keyed by letter + start position.

## Scope Boundaries

**In scope:**
- Midpoint data model and correction table
- Algorithmic midpoint computation
- Viewer granularity toggle (half-step mode)
- GranularityAdapter component
- Half-step pictograph rendering via existing pipeline

**Out of scope:**
- New arrow SVGs (gap analysis determines if any are needed)
- Mandala-path arrows (killed)
- Dyad mode (separate spec)
- Half-step export or persistence
- Animation/playback changes beyond navigation granularity
