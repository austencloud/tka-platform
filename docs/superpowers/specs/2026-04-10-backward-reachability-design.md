# Backward Reachability Analysis for Sequence Generation

**Date:** 2026-04-10
**Status:** Draft
**Problem:** Beam search dead-ends when hard constraints + LOOP end-position requirements create an unreachable goal

---

## 1. Problem Statement

The sequence engine's beam search builds sequences forward, one beat at a time. On the final beat of a LOOP seed, it must land at a specific end position (determined by the LOOP type and slice size). Hard constraints (e.g. "no dash motions") filter which variations are available at each beat.

The search has no lookahead. It greedily picks the best-scoring variations at each beat, unaware that its choices are steering toward positions where the final beat's combined requirements (LOOP endpoint + hard constraints) are unsatisfiable. By the time it reaches the final beat, every beam state is at a position with zero valid continuations. The search fails.

**Concrete example from the bug report:**
- 4-beat seed (quartered rotated LOOP, total length 16)
- Hard constraint: exclude dash motions
- 13 blocked start positions
- Beats 1-3 succeed, beat 4 fails — no non-dash variation at any beam state's position can reach a LOOP-compatible endpoint

**Current workaround:** Retry with wider beam widths (10 → 25 → 60). This helps probabilistically but wastes compute exploring doomed paths, and can still fail if the constraint space is tight.

---

## 2. Background: CSP Theory

This is a **Constraint Satisfaction Problem (CSP)** with a chain structure:

- **Variables:** X₀, X₁, ..., Xₙ₋₁ where Xᵢ = the variation chosen for beat i
- **Domains:** Dᵢ = set of PictographData variations that pass hard constraints at beat i
- **Constraints:**
  - **Position continuity (binary):** endPosition(Xᵢ) = startPosition(Xᵢ₊₁)
  - **LOOP endpoint (unary):** endPosition(Xₙ₋₁) ∈ requiredEndPositions
  - **Blocked starts (unary):** startPosition(X₀) ∉ blockedStartPositions

In CSP literature, the standard preprocessing step is **arc consistency** — removing domain values that can't participate in any solution. For a chain graph, this is achieved by:

1. **Backward pass:** Propagate the goal constraint (LOOP endpoint) backward through each beat, pruning positions that can't reach the goal
2. **Forward pass:** Propagate start constraints forward (implicit in the beam search itself)

The relevant algorithm is **Directional Arc Consistency (DAC)**, which for chain graphs runs in O(n × d²) where n = number of variables and d = domain size. With ~56 positions and 4 beats, this is microseconds.

**Key insight:** After establishing arc consistency, every value in every domain is guaranteed to have at least one valid continuation toward the goal. The beam search can never dead-end due to future constraints it can't anticipate.

---

## 3. Proposed Solution: PositionReachabilityAnalyzer

A preprocessing step that computes, for each beat index, which positions are **backward-reachable** from the goal. The beam search then uses this map to prune candidates whose endPosition leads to a dead end.

### 3.1 Data Structures

```typescript
/**
 * For each beat index, the set of startPositions from which the goal
 * is reachable using only hard-constraint-satisfying variations.
 */
interface ReachabilityResult {
  /** reachableAt[i] = positions valid as startPosition for beat i */
  reachableAt: Set<string>[];

  /** True if the goal is reachable from at least one non-blocked start */
  feasible: boolean;

  /** If !feasible, which beat has the empty reachable set */
  emptyBeatIndex?: number;
}
```

### 3.2 Algorithm

```
function analyze(
  seedLength: number,
  requiredEndPositions: Set<string>,
  validVariations: PictographData[],   // pre-filtered by hard constraints
  blockedStartPositions?: Set<string>,
): ReachabilityResult

  // Step 1: Build position transition graph from valid variations
  // transitionsFrom[pos] = set of endPositions reachable from pos
  transitionsFrom: Map<string, Set<string>>
  // transitionsTo[pos] = set of startPositions that can reach pos
  transitionsTo: Map<string, Set<string>>

  for each v in validVariations:
    transitionsFrom[v.startPosition].add(v.endPosition)
    transitionsTo[v.endPosition].add(v.startPosition)

  // Step 2: Backward pass from goal
  reachableAt = new Array(seedLength)

  // Final beat: startPositions that have at least one transition
  // ending in requiredEndPositions
  reachableAt[seedLength - 1] = { pos : transitionsFrom[pos] ∩ requiredEndPositions ≠ ∅ }

  // Propagate backward
  for i = seedLength - 2 down to 0:
    reachableAt[i] = { pos : transitionsFrom[pos] ∩ reachableAt[i + 1] ≠ ∅ }

  // Step 3: Apply blocked start positions to beat 0
  if blockedStartPositions:
    reachableAt[0] = reachableAt[0] \ blockedStartPositions

  // Step 4: Forward cleanup — a position at beat i is only useful if
  // it can be reached from a position at beat i-1
  for i = 1 to seedLength - 1:
    reachableAt[i] = { pos : transitionsTo[pos] ∩ reachableAt[i - 1] ≠ ∅ }
    // Note: must intersect with existing reachableAt[i] from backward pass
    reachableAt[i] = reachableAt[i] ∩ backwardReachableAt[i]

  // Step 5: Check feasibility
  feasible = all sets non-empty
  emptyBeatIndex = first i where reachableAt[i] is empty, or undefined

  return { reachableAt, feasible, emptyBeatIndex }
```

**Complexity:** O(seedLength × |positions|² ) — with 56 positions and seeds up to ~8 beats, this is < 25,000 operations. Negligible.

### 3.3 Integration with BeamSearch

`BeamSearch.searchByLength()` receives an optional `ReachabilityResult`. At each beat, candidates are filtered:

```typescript
// In the beat loop, after finding candidates at current position:
if (reachability && i < length - 1) {
  // Only keep variations whose endPosition is reachable for the next beat
  candidates = candidates.filter(
    p => reachability.reachableAt[i + 1].has(p.endPosition)
  );
}
```

This replaces the current final-beat-only LOOP endpoint filter with a per-beat reachability filter. The final beat's filter is subsumed — `reachableAt[length-1]` already encodes the LOOP endpoint requirement.

### 3.4 Integration with SequenceBuilder

In `buildByLength()`, before the beam search loop:

```typescript
// Compute reachability when LOOP targeting + hard constraints both present
let reachability: ReachabilityResult | undefined;
if (requiredEndPositions && requiredEndPositions.size > 0) {
  const analyzer = new PositionReachabilityAnalyzer();
  const validVariations = this.getHardConstraintFilteredVariations(
    nonType6, constraintSet.hard
  );
  reachability = analyzer.analyze(
    length,
    requiredEndPositions,
    validVariations,
    searchOptions.blockedStartPositions,
  );

  // Fail fast with a clear message if the constraints are provably impossible
  if (!reachability.feasible) {
    throw new Error(
      `No valid ${length}-beat path exists: beat ${reachability.emptyBeatIndex! + 1} ` +
      `has no reachable positions given the current constraints`
    );
  }
}
```

The reachability map is passed through to `BeamSearch.searchByLength()`.

---

## 4. File Structure

```
packages/sequence-engine/src/generation/
├── reachability/
│   ├── PositionReachabilityAnalyzer.ts    # Core algorithm
│   └── PositionTransitionGraph.ts         # Adjacency graph builder
├── builder/
│   ├── SequenceBuilder.ts                 # Updated: calls analyzer before beam search
│   └── BeamSearch.ts                      # Updated: accepts + uses ReachabilityResult
```

### 4.1 PositionTransitionGraph

Builds a bidirectional adjacency graph from a set of PictographData variations:

```typescript
export class PositionTransitionGraph {
  private readonly forward: Map<string, Set<string>>;   // startPos → endPositions
  private readonly reverse: Map<string, Set<string>>;   // endPos → startPositions

  constructor(variations: PictographData[]) { ... }

  getReachableFrom(position: string): Set<string> { ... }
  getReachableTo(position: string): Set<string> { ... }
  getAllPositions(): Set<string> { ... }
}
```

### 4.2 PositionReachabilityAnalyzer

```typescript
export class PositionReachabilityAnalyzer {
  analyze(
    seedLength: number,
    requiredEndPositions: Set<string>,
    validVariations: PictographData[],
    blockedStartPositions?: Set<string>,
  ): ReachabilityResult { ... }
}
```

---

## 5. What This Replaces / Changes

### 5.1 Removes

- The beam widening retry in `GenerationOrchestrator.buildWithRetry()` — no longer needed for this class of failures. Can keep a single retry (width 10 → 20) as a general safety net for other failure modes.

### 5.2 Changes in BeamSearch.searchByLength()

**Before (lines 515-520):**
```typescript
// Final beat only — filter to LOOP-compatible endpoints
const isFinalBeat = i === length - 1;
if (isFinalBeat && requiredEndPositions && requiredEndPositions.size > 0) {
  candidates = candidates.filter(p => requiredEndPositions.has(p.endPosition));
}
```

**After:**
```typescript
// Every beat — filter to positions reachable toward the goal
if (reachability && i < length - 1) {
  candidates = candidates.filter(
    p => reachability.reachableAt[i + 1].has(p.endPosition)
  );
} else if (i === length - 1 && requiredEndPositions && requiredEndPositions.size > 0) {
  // Fallback for when reachability wasn't computed (no LOOP + hard constraints)
  candidates = candidates.filter(p => requiredEndPositions.has(p.endPosition));
}
```

### 5.3 Changes in SequenceBuilder.buildByLength()

Add reachability computation after assembling constraints and before the beam search loop. Pass the result to `BeamSearch.searchByLength()` as a new parameter.

### 5.4 Changes in BeamSearch.searchByLength() signature

Add optional parameter:
```typescript
searchByLength(
  length: number,
  startPosition: string | undefined,
  constraintSet: ConstraintSet,
  beamWidth?: number,
  requiredEndPositions?: Set<string>,
  loopPositionMap?: Record<string, string[]>,
  options?: { ... },
  turnAllocation?: TurnAllocation,
  propContinuity?: PropContinuityMode,
  reachability?: ReachabilityResult,        // NEW
): BeamSearchResult
```

---

## 6. Edge Cases

| Case | Behavior |
|------|----------|
| No LOOP requirement | Skip reachability analysis entirely — no goal to propagate from |
| No hard motion constraints | All variations are valid, transition graph is fully connected — reachability adds no value but is harmless. Skip for efficiency. |
| Reachability says infeasible | Fail fast with a clear error: "No valid N-beat path exists with these constraints" |
| Single-beat seed (length=1) | Backward pass is trivial: reachableAt[0] = positions with endPosition ∈ requiredEndPositions |
| loopPositionMap (random start) | Compute reachability per-start-position lazily after the first beat is selected, or compute for all possible starts upfront |
| Word-based generation | Reachability could apply but letter constraints add another dimension. Phase 2 consideration. |

---

## 7. Testing Strategy

### Unit tests for PositionReachabilityAnalyzer

1. **Simple chain:** 3 positions A→B→C, goal=C, verify reachableAt = [{A}, {B}, {C}]
2. **Dead end:** A→B, B→C, goal=D — verify feasible=false, emptyBeatIndex=2
3. **Blocked start:** A→B→C, goal=C, blocked={A} — verify feasible=false
4. **Multiple paths:** A→B, A→C, B→D, C→D, goal=D — verify both B and C reachable at beat 1
5. **Longer seed:** 4-beat path with branching, verify backward pass prunes correctly
6. **Forward cleanup:** Position reachable backward but not forward (no path from start reaches it)

### Integration test with BeamSearch

1. Reproduce the original bug: choppy + no-dash + quartered rotated LOOP + blocked positions
2. Verify the search succeeds with reachability analysis where it previously failed at width 10
3. Verify the search fails fast when constraints are truly impossible

---

## 8. Why This Is the Right Approach

**Vs. beam widening retry:** Beam widening is probabilistic — it might work, might not. Reachability is deterministic — it guarantees the search space contains a valid path or proves it doesn't. It also means the beam search never wastes lanes exploring doomed paths, making width 10 as effective as width 60.

**Vs. constraint relaxation:** Relaxing user constraints (demoting no-dash to soft) violates user intent. The user said "no dash" and expects zero dash motions. Reachability respects all constraints while finding paths through the valid space.

**Vs. backtracking search:** Full backtracking (DFS with constraint propagation) would find a solution if one exists, but loses the beam search's ability to optimize for soft constraints (continuity, hand path smoothness). Reachability + beam search gives us both: guaranteed validity from reachability, quality optimization from beam scoring.

**From CSP literature:** Establishing arc consistency before search is the single most impactful preprocessing step for constraint satisfaction. It often reduces the search space by orders of magnitude. For chain-structured CSPs (like our beat sequence), it runs in linear time and is always worth doing.
