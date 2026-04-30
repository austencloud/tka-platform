# Exhaustive Loop Comparer Architecture

**Date:** 2026-04-30
**Status:** Draft
**Prerequisite:** Foundation refactor (same-date spec) — already implemented

## Problem

The LOOP detection system uses a monolithic `LOOPDetector` that grew organically. Detection logic for each transformation type is interleaved with orchestration, interval management, and candidate formatting. Adding or modifying a single transformation check requires understanding the entire 1000+ line file. The system can't answer "does this sequence exhibit mirrored_swapped_inverted?" without tracing through multiple branching code paths.

## Goal

Replace the monolithic detection with a data-driven, pipeline-based architecture. The full set of 16 valid loop types is defined as a single declaration table. One generic unanimity function processes all of them. Detection becomes a pipeline of small, named, pure-function stages — each independently testable, none aware of the others.

## The 16 Loop Types

Derived from 3 independent axes — spatial × color × direction — verified against production Firestore data (400+ sequences) and the existing `TRANSFORMATION_PRIORITY` constant.

### Singles (6)

| # | Type | Spatial | Color | Direction | Observed in Firestore |
|---|------|---------|-------|-----------|:---:|
| 1 | rotated | rotation | same | normal | ✅ |
| 2 | mirrored | mirror | same | normal | ✅ |
| 3 | flipped | flip | same | normal | ✅ |
| 4 | swapped | none | swapped | normal | ✅ |
| 5 | inverted | none | same | inverted | ✅ |
| 6 | repeated | identity | same | normal | ✅ |

### Doubles (7)

| # | Type | Spatial | Color | Direction | Observed in Firestore |
|---|------|---------|-------|-----------|:---:|
| 7 | rotated_inverted | rotation | same | inverted | ✅ |
| 8 | mirrored_inverted | mirror | same | inverted | ❌ (valid) |
| 9 | flipped_inverted | flip | same | inverted | ✅ |
| 10 | rotated_swapped | rotation | swapped | normal | ✅ |
| 11 | mirrored_swapped | mirror | swapped | normal | ✅ |
| 12 | flipped_swapped | flip | swapped | normal | ❌ (valid) |
| 13 | swapped_inverted | none | swapped | inverted | ❌ (valid) |

### Triples (3)

| # | Type | Spatial | Color | Direction | Observed in Firestore |
|---|------|---------|-------|-----------|:---:|
| 14 | rotated_swapped_inverted | rotation | swapped | inverted | ✅ |
| 15 | mirrored_swapped_inverted | mirror | swapped | inverted | ❌ (valid) |
| 16 | flipped_swapped_inverted | flip | swapped | inverted | ❌ (valid) |

### Orthogonal

**Rewound** — always period 2, sequence-level, doesn't combine with other components. Detected as a separate pass outside the pipeline. Unchanged from current system.

### Why these 16 and no more

- Spatial operations are mutually exclusive at a single beat-pair: mirror + flip = rotated_180, so two spatial ops can't co-occur.
- Each beat pair has exactly ONE spatial operation (or none) combined with zero or more of swapped/inverted.
- `repeated` is identity — no transformation at all.
- This enumeration matches `TRANSFORMATION_PRIORITY` in `transformation-priority.ts` exactly.

### Combo labels are atomic, not decomposable

Empirically verified: a `rotated_swapped` sequence does NOT necessarily pass both `rotated` and `swapped` independently. `rotated_swapped` checks cross-color rotation (blue₁→red₂), which is a fundamentally different geometric relationship than same-color rotation. The code in `RotationComparer.checkSwappedColorRotations` confirms this — it's an independent geometric test, not a composition of two simpler tests.

## Architecture

### Loop Type Definition Table

The entire loop type territory is a single declarative constant. No classes, no registry, no per-type files.

```ts
interface LoopTypeDefinition {
  readonly id: string;
  readonly targets: readonly string[];   // beat-pair labels that satisfy this type
  readonly components: readonly ComponentId[];
  readonly extractDirection?: boolean;   // true for rotated-family types
}

const LOOP_TYPE_DEFINITIONS: readonly LoopTypeDefinition[] = [
  // Singles
  { id: "rotated",   targets: ["rotated_90_cw", "rotated_90_ccw", "rotated_180"], components: ["rotated"], extractDirection: true },
  { id: "mirrored",  targets: ["mirrored"],  components: ["mirrored"] },
  { id: "flipped",   targets: ["flipped"],   components: ["flipped"] },
  { id: "swapped",   targets: ["swapped"],   components: ["swapped"] },
  { id: "inverted",  targets: ["inverted"],  components: ["inverted"] },
  { id: "repeated",  targets: ["repeated"],  components: ["repeated"] },

  // Doubles
  { id: "rotated_inverted",  targets: ["rotated_90_cw_inverted", "rotated_90_ccw_inverted", "rotated_180_inverted"], components: ["rotated", "inverted"], extractDirection: true },
  { id: "mirrored_inverted", targets: ["mirrored_inverted"], components: ["mirrored", "inverted"] },
  { id: "flipped_inverted",  targets: ["flipped_inverted"],  components: ["flipped", "inverted"] },
  { id: "rotated_swapped",   targets: ["rotated_90_cw_swapped", "rotated_90_ccw_swapped", "rotated_180_swapped"], components: ["rotated", "swapped"], extractDirection: true },
  { id: "mirrored_swapped",  targets: ["mirrored_swapped"], components: ["mirrored", "swapped"] },
  { id: "flipped_swapped",   targets: ["flipped_swapped"],  components: ["flipped", "swapped"] },
  { id: "swapped_inverted",  targets: ["swapped_inverted"], components: ["swapped", "inverted"] },

  // Triples
  { id: "rotated_swapped_inverted",  targets: ["rotated_90_cw_swapped_inverted", "rotated_90_ccw_swapped_inverted", "rotated_180_swapped_inverted"], components: ["rotated", "swapped", "inverted"], extractDirection: true },
  { id: "mirrored_swapped_inverted", targets: ["mirrored_swapped_inverted"], components: ["mirrored", "swapped", "inverted"] },
  { id: "flipped_swapped_inverted",  targets: ["flipped_swapped_inverted"],  components: ["flipped", "swapped", "inverted"] },
] as const;
```

Adding a new loop type = one line in this table. The entire loop type territory is readable in one screen.

### Formal Link to TRANSFORMATION_PRIORITY

`TRANSFORMATION_PRIORITY` defines the ordering of beat-pair labels. `LOOP_TYPE_DEFINITIONS` defines which labels constitute each loop type. These two lists must cover the same universe of labels — every target in the definitions must appear in the priority list, and every entry in the priority list must be a target of some definition.

Rather than defending this with a runtime test alone, `loop-type-definitions.ts` exports a derived constant:

```ts
export const ALL_DEFINITION_TARGETS: ReadonlySet<string> = new Set(
  LOOP_TYPE_DEFINITIONS.flatMap(d => d.targets)
);
```

The static validation test asserts bidirectional set equality: `ALL_DEFINITION_TARGETS` === `new Set(TRANSFORMATION_PRIORITY)`. One set, two views — impossible to drift.

### Check Result

```ts
interface UnanimityResult {
  definition: LoopTypeDefinition;
  interval: 2 | 4;
  matches: boolean;
  matchedTarget: string | null;    // which specific target label was unanimous
  direction: "cw" | "ccw" | null;  // extracted from rotation variant
  beatPairCount: number;           // how many pairs were tested
}
```

### Generic Unanimity Function

ONE function processes all 16 definitions. No per-type logic.

```ts
function checkUnanimity(
  definition: LoopTypeDefinition,
  beatPairLabels: Map<string, string[]>,  // pairKey → cached labels
  interval: 2 | 4
): UnanimityResult
```

For each target label in `definition.targets`, check if it appears in ALL beat pairs at the given interval. If any target is unanimous, the type matches. For rotated-family types, extract direction from the matched variant.

### Detection Pipeline

Detection is a sequence of small, named, pure-function stages. Each takes input and returns output. No stage mutates shared state. No stage knows about the others.

```ts
// Stage 1: Compare all beat pairs, cache results
function compareBeatPairs(
  steps: StepData[],
  orchestrator: StepComparisonOrchestrator
): ComparisonMatrix

// Stage 2: Run unanimity checks for all 16 types at both intervals
function runUnanimityChecks(
  matrix: ComparisonMatrix,
  definitions: LoopTypeDefinition[]
): UnanimityResult[]

// Stage 3: Filter to matched results, resolve interval precedence
function mergeIntervals(
  results: UnanimityResult[]
): MergedMatch[]

// Stage 4: Apply strict_ prefix if exactly one type matched
function applyStrictPrefix(
  matches: MergedMatch[]
): MergedMatch[]

// Stage 5: Run rewound check (orthogonal, always period 2)
function checkRewound(
  steps: StepData[]
): RewoundResult

// Stage 6: Build candidate designations from merged results
function buildCandidates(
  matches: MergedMatch[],
  rewound: RewoundResult
): CandidateDesignation[]
```

The pipeline composes as:

```ts
function detectLoopPattern(steps: StepData[]): CandidateDesignation[] {
  const matrix    = compareBeatPairs(steps, orchestrator);
  const results   = runUnanimityChecks(matrix, LOOP_TYPE_DEFINITIONS);
  const merged    = mergeIntervals(results);
  const strict    = applyStrictPrefix(merged);
  const rewound   = checkRewound(steps);
  return buildCandidates(strict, rewound);
}
```

Six lines. Each function testable in isolation. Adding logging, metrics, or debugging = wrap a stage, don't modify it.

### Comparison Matrix

The orchestrator compares each beat pair ONCE, caching the full set of transformation labels. All unanimity checks read from the cache.

```ts
interface ComparisonMatrix {
  halvedPairs: Map<string, string[]>;     // pairKey → labels for interval-2 pairs
  quarteredPairs: Map<string, string[]>;  // pairKey → labels for interval-4 pairs
}
```

For a 16-beat sequence: 8 halved pairs + 4 quartered pairs = 12 comparisons total. All 16 × 2 unanimity checks filter from these 12 cached results.

### Interval Merging Rules

When a type matches at both intervals:
- Period 4 takes precedence (more specific pattern)
- Example: `rotated` matches at both 2 and 4 → report as period 4

When different types match at different intervals:
- Each type keeps its own interval
- Example: `rotated` at period 4, `swapped` at period 2 → `TransformationIntervals { rotation: 4, swap: 2 }`

### strict_ Designation

Post-processing. After collecting all matched types across both intervals:
- If exactly ONE type matched (no other loop type detected at any interval) → prefix with `strict_`
- Example: only `rotated` matched at period 4 → `strict_rotated`
- Example: `rotated` at period 4 + `swapped` at period 2 → NOT strict (two types co-occur)
- Example: only `rotated_swapped` matched → `strict_rotated_swapped` (one type, even though it has 2 components)

### Scope: Uniform Patterns Only

This architecture handles uniform loop detection — where a transformation is unanimous across ALL beat pairs at an interval. The existing **modular detection** (where different sections exhibit different transformations, e.g. columns A and C are mirrored while columns B and D are rotated) remains a separate path. When no uniform pattern matches, the pipeline returns empty and the caller falls through to modular detection.

## File Structure

```
src/lib/features/loop-labeler/
  domain/
    constants/
      loop-type-definitions.ts      # The declaration table (LOOP_TYPE_DEFINITIONS)
      transformation-priority.ts    # Unchanged
  services/
    implementations/
      detection/
        types.ts                    # ComparisonMatrix, UnanimityResult, MergedMatch
        compare-beat-pairs.ts       # Stage 1: build comparison matrix
        run-unanimity-checks.ts     # Stage 2: generic unanimity function + loop over definitions
        merge-intervals.ts          # Stage 3: interval precedence resolution
        apply-strict-prefix.ts      # Stage 4: one-liner
        check-rewound.ts            # Stage 5: orthogonal rewound pass
        build-candidates.ts         # Stage 6: format results into CandidateDesignation[]
        detect-loop-pattern.ts      # Pipeline composition (the 6-line function)
        index.ts                    # Public API export
      
      comparison/                   # Unchanged — existing comparers stay
        RotationComparer.ts
        ReflectionComparer.ts
        SwapInvertComparer.ts
        StepComparisonOrchestrator.ts
```

No checker classes. No registry. No 16 files that do the same thing. The definition table + generic unanimity function replaces all of it.

## What Changes

- **`LOOPDetector.ts`**: Uniform detection logic extracted into the pipeline. LOOPDetector becomes a thin facade: calls `detectLoopPattern()` for uniform detection, falls through to existing modular detection if no result.
- **`CandidateFormatter`**: Most methods superseded. `deriveComponentsFromPattern` (string-includes parser), `extractRotationDirection`, and `formatCandidateDescription` (90-line if/else chain) all become dead code — the definition table has `components` and `extractDirection` as first-class data, and `buildCandidates` constructs `CandidateInfo` directly from `LoopTypeDefinition` + `UnanimityResult`. Only `formatSingleTransformation` (display formatting) and `toCandidateDesignation` (shape adapter) survive. `buildCandidateDesignations` is replaced entirely by pipeline Stage 6.
- **New file: `loop-type-definitions.ts`**: The declaration table. Source of truth for the loop type territory.
- **New files: 7 pipeline stage files** + types + index = 10 new files total, each small and focused.

## What Doesn't Change

- Beat pair extraction logic (how halved/quartered pairs are formed)
- The geometric comparison math in existing comparers
- `StepComparisonOrchestrator` — the pipeline calls it as-is
- `TransformationIntervals` type (already migrated to numeric in foundation refactor)
- The rewound detection logic (moved to its own stage but same algorithm)
- `transformation-priority.ts` — already correct and complete
- UI components (they consume `CandidateDesignation` which stays the same shape)
- The `auto-label-loops.cjs` script (consumes the same detection API)
- Modular detection path (out of scope, called as fallback)

## Migration Strategy

1. Build pipeline stages alongside existing detection code (no deletions yet)
2. Wire up `detectLoopPattern()` in parallel — LOOPDetector runs both old and new, compares outputs via assertion
3. Validate against golden snapshot tests + full Firestore corpus
4. Once outputs match, remove old detection paths from LOOPDetector
5. LOOPDetector becomes facade: `detectLoopPattern()` → modular fallback → freeform

## Test Strategy

- **Unit tests per stage**: Each of the 6 pipeline stages gets its own test file with known inputs/outputs
- **Definition table validation**: Static test that the set of all targets across `LOOP_TYPE_DEFINITIONS` equals the set of labels in `TRANSFORMATION_PRIORITY` (bidirectional — catches typos, drift, AND orphaned priority entries)
- **Unanimity function tests**: For each of the 16 definitions, a test with a beat-pair set that should match and one that shouldn't
- **Pipeline integration tests**: Using the existing golden snapshots from LOOPDetector tests
- **Full corpus validation**: Run pipeline against all 400+ Firestore sequences, compare loopType output to stored loopType
- **Regression**: Existing 9 LOOPDetector tests must pass unchanged through the facade

## Risks

- **Behavioral drift during migration**: New pipeline might produce slightly different results for edge cases. Mitigation: parallel execution with assertion comparison before switching over.
- **Modular fallthrough logic**: When no uniform pattern matches, the caller must fall through to modular detection cleanly. The pipeline returns an empty array — the facade must handle this transition without dropping sequences.
- **Definition table correctness**: A typo in a target label silently disables a type. Mitigation: bidirectional set-equality test between definition targets and `TRANSFORMATION_PRIORITY` catches both directions of drift.
