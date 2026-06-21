# LOOP Detection Foundation Refactor

**Date:** 2026-04-30
**Status:** Approved (verbal)
**Approach:** C (Hybrid) — incremental fixes now, restructure later with test safety net

## Context

Period is per-component, not per-sequence. Each of the 6 components (rotated, mirrored, flipped, swapped, inverted, rewound) independently has period 2 or 4. The detection system predates this understanding — it was built when "quartered" meant "90° rotation" and nothing else.

Three concrete gaps:

1. **TransformationIntervals uses strings** (`"halved"` | `"quartered"`) instead of numeric periods (2 | 4). The modular path emits unparseable `"positional:1-2-1-2"` strings that `periodFromIntervals` silently drops.
2. **Quartered detector filters to rotation-only** (LOOPDetector.ts line 278), discarding quartered-level mirror/swap/flip/invert detections that the comparers already produce.
3. **Modular system only tracks `isSwapped` per column**, missing invert/mirror/flip variation across columns.

Rewound is orthogonal — always period 2, sequence-level (not column-level), doesn't combine with other components. Not touched in this refactor.

## Changes

### 1. TransformationIntervals → numeric periods

**File:** `label-models.ts`

```ts
// Before
export type TransformationIntervals = Record<string, string>;

// After
export type TransformationIntervals = Record<string, 2 | 4>;
```

**File:** `LOOPDetector.ts` — `periodFromIntervals`

```ts
// Before: string matching "halved" → 2, "quartered" → 4
// After: Math.max(...Object.values(intervals))
```

All call sites that write `"halved"` or `"quartered"` strings change to `2` or `4`. The `"positional:"` strings in the modular path become `4` (they're quartered-level patterns).

### 2. Quartered detector: widen filter

**File:** `LOOPDetector.ts` — `detectQuarteredPattern`

Remove the rotation-only filter at line 278. Extract ALL components from the quartered-common set. The rotation-specific guard (`quarteredMotionsConsistent`) stays but applies only to the rotation component — if motions are inconsistent, rotation drops out but mirror/swap/flip/invert found at quartered level survive.

### 3. Enrichment logic update

**File:** `LOOPDetector.ts` — `enrichWithHalvedPrimitives`

Two changes:
- Add `swapped` to the primitives list (currently only checks inverted/mirrored/flipped)
- Interval values become numeric (`2` instead of `"halved"`)

The existing skip-if-already-found logic is correct and stays.

### 4. ColumnBehavior expansion

**File:** `ITransformationAnalyzer.ts`

```ts
export interface ColumnBehavior {
  position: number;
  baseTransformation: string;  // captures rotation type+direction
  isSwapped: boolean;
  isInverted: boolean;
  isMirrored: boolean;
  isFlipped: boolean;
  steps: number[];
  transformations: string[];
}
```

**File:** `TransformationAnalyzer.ts` — `detectModularPattern`

Populate `isInverted`, `isMirrored`, `isFlipped` using the same pattern as `isSwapped` — check if column's raw transformations unanimously contain the relevant label.

### 5. Modular quartered: emit all components

**File:** `LOOPDetector.ts` — `detectModularQuarteredPattern`

After extracting rotation + swap, also check `modularAnalysis.columnBehaviors` for mirror/invert/flip presence. Add to components array + intervals (all at period 4 since they're quartered-level modular patterns).

## What stays unchanged

- Internal comparison labels (`rotated_90_cw`, `mirrored`, `swapped_inverted`, etc.) — geometric names stay
- Comparer internals (`RotationComparer`, `ReflectionComparer`, `SwapInvertComparer`) — already check everything
- `StepComparisonOrchestrator.compareStepPair` — already runs all comparers for every pair
- Beat pair generation (`generateHalvedBeatPairs`, `generateQuarteredBeatPairs`)
- Rewound detection — orthogonal, always period 2, sequence-level
- Transformation priority order
- Transformation family groupings

## Test plan

1. **Golden snapshots** — known-good sequences that currently detect correctly. Regression safety net.
2. **Quartered non-rotation** — sequence with period-4 mirror but period-2 rotation. Currently missed. Assert both components with correct periods.
3. **Numeric period round-trip** — `periodFromIntervals` with numeric values returns correct max.
4. **Modular with invert/mirror/flip** — modular quartered where columns vary in invert behavior. Assert `isInverted` populated per column.
5. **Enrichment ordering** — period-4 component not overwritten to period 2 by enrichment pass.
6. **Swapped in enrichment** — period-2 swap added correctly by enrichment.

## Blast radius

- 10 files reference `rotated_90`/`rotated_180` — all within loop-labeler + scripts + tests
- 13 files reference `TransformationInterval` — same scope
- Scripts (`backfill-arena-loops.cjs`, `auto-label-loops.cjs`, `beat-pair-detection.cjs`) need string→number updates where they write intervals
- Zero external consumers — loop-labeler is self-contained
