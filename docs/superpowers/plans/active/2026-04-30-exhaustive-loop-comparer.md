# Exhaustive Loop Comparer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace monolithic uniform detection in LOOPDetector with a data-driven pipeline of pure functions, driven by a single declaration table of 16 loop types.

**Architecture:** A `LOOP_TYPE_DEFINITIONS` declaration table enumerates all 16 valid loop types. A generic unanimity function checks each definition against a cached comparison matrix. Six pipeline stages (compare → unanimity → merge → strict → rewound → build) compose into a single `detectUniformPattern()` function. LOOPDetector becomes a thin facade that calls the pipeline, then falls through to modular/freeform if no result.

**Tech Stack:** TypeScript, Vitest, existing comparers (RotationComparer, ReflectionComparer, SwapInvertComparer, StepComparisonOrchestrator)

---

## File Structure

```
src/lib/features/loop-labeler/
  domain/constants/
    loop-type-definitions.ts        # CREATE — declaration table + ALL_DEFINITION_TARGETS
    transformation-priority.ts      # UNCHANGED — already correct
  services/implementations/
    detection/
      types.ts                      # CREATE — ComparisonMatrix, UnanimityResult, MergedMatch
      compare-beat-pairs.ts         # CREATE — Stage 1: build comparison matrix from steps
      run-unanimity-checks.ts       # CREATE — Stage 2: generic unanimity + loop over definitions
      merge-intervals.ts            # CREATE — Stage 3: interval precedence resolution
      apply-strict-prefix.ts        # CREATE — Stage 4: strict_ post-processing
      check-rewound.ts              # CREATE — Stage 5: orthogonal rewound detection
      build-candidates.ts           # CREATE — Stage 6: MergedMatch[] → CandidateDesignation[]
      detect-uniform-pattern.ts     # CREATE — pipeline composition (the 6-line function)
      index.ts                      # CREATE — public API re-export
    LOOPDetector.ts                 # MODIFY — replace detectHalvedPattern/detectQuarteredPattern
                                    #   with detectUniformPattern() call; keep modular/freeform paths
    CandidateFormatter.ts           # MODIFY — remove superseded methods (deriveComponentsFromPattern,
                                    #   extractRotationDirection, formatCandidateDescription,
                                    #   buildCandidateDesignations); keep formatSingleTransformation,
                                    #   toCandidateDesignation, toPublicStepPairs,
                                    #   formatBeatPairTransformations
    comparison/
      StepComparisonOrchestrator.ts # UNCHANGED — pipeline calls it as-is

tests/unit/loop-labeler/
  detection/
    loop-type-definitions.test.ts   # CREATE — bidirectional target/priority validation
    run-unanimity-checks.test.ts    # CREATE — unanimity function per definition
    merge-intervals.test.ts         # CREATE — interval precedence
    apply-strict-prefix.test.ts     # CREATE — strict_ logic
    build-candidates.test.ts        # CREATE — candidate construction
    detect-uniform-pattern.test.ts  # CREATE — pipeline integration (golden snapshots)
  LOOPDetector.test.ts              # UNCHANGED — existing 9 tests must pass through facade
```

---

## Important Context for Implementers

### How the comparison system works

`StepComparisonOrchestrator.compareStepPair(step1, step2)` runs all three comparers (rotation, reflection, swap-invert) and returns a flat `string[]` of ALL transformation labels that apply to that beat pair. Labels are atomic strings from `TRANSFORMATION_PRIORITY` — e.g., `"rotated_90_cw"`, `"mirrored_swapped_inverted"`, `"repeated"`.

`StepComparisonOrchestrator.generateHalvedBeatPairs(steps)` compares step[i] with step[halfLength + i] for all i. Returns `InternalStepPair[]` where each pair has `rawTransformations: string[]`.

`StepComparisonOrchestrator.generateQuarteredBeatPairs(steps)` compares step[i] with step[(i + quarterLength) % length] for ALL i (includes wrap-around). Returns `InternalStepPair[]`.

### What "unanimity" means

A loop type "matches" at a given interval when ONE of its target labels appears in the `rawTransformations` of ALL beat pairs at that interval. Example: `rotated` has targets `["rotated_90_cw", "rotated_90_ccw", "rotated_180"]`. If every quartered beat pair's `rawTransformations` includes `"rotated_90_cw"`, then `rotated` matches at interval 4 with `matchedTarget = "rotated_90_cw"`.

### Key types already defined (do NOT redefine)

- `ExtractedStep` — `src/lib/features/loop-labeler/domain/models/internal-step-models.ts:7`
- `InternalStepPair` — same file, line 29
- `CandidateInfo` — same file, line 40
- `ColorData` — same file, line 52
- `ComponentId` — `src/lib/features/loop-labeler/domain/constants/loop-components.ts:70` — union of `"rotated" | "swapped" | "mirrored" | "flipped" | "inverted" | "rewound" | "repeated" | "modular"`
- `TransformationIntervals` — `src/lib/features/loop-labeler/domain/models/label-models.ts:35`
- `CandidateDesignation` — same file, line 64
- `LOOPDetectionResult` — `src/lib/features/loop-labeler/services/contracts/ILOOPDetector.ts:79`
- `IStepComparisonOrchestrator` — `src/lib/features/loop-labeler/services/contracts/IStepComparisonOrchestrator.ts:11`
- `TRANSFORMATION_PRIORITY` — `src/lib/features/loop-labeler/domain/constants/transformation-priority.ts:5` — 24 entries

### Test command

```bash
npx vitest run --config tests/config/vitest.config.ts tests/unit/loop-labeler/
```

---

### Task 1: Loop Type Definitions Table

**Files:**
- Create: `src/lib/features/loop-labeler/domain/constants/loop-type-definitions.ts`
- Create: `tests/unit/loop-labeler/detection/loop-type-definitions.test.ts`

- [ ] **Step 1: Write the definition table**

```ts
// src/lib/features/loop-labeler/domain/constants/loop-type-definitions.ts

import type { ComponentId } from "./loop-components";

export interface LoopTypeDefinition {
  readonly id: string;
  readonly targets: readonly string[];
  readonly components: readonly ComponentId[];
  readonly extractDirection?: boolean;
}

export const LOOP_TYPE_DEFINITIONS: readonly LoopTypeDefinition[] = [
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

export const ALL_DEFINITION_TARGETS: ReadonlySet<string> = new Set(
  LOOP_TYPE_DEFINITIONS.flatMap(d => [...d.targets])
);
```

- [ ] **Step 2: Write the bidirectional validation test**

```ts
// tests/unit/loop-labeler/detection/loop-type-definitions.test.ts

import { describe, it, expect } from "vitest";
import {
  LOOP_TYPE_DEFINITIONS,
  ALL_DEFINITION_TARGETS,
} from "$lib/features/loop-labeler/domain/constants/loop-type-definitions";
import { TRANSFORMATION_PRIORITY } from "$lib/features/loop-labeler/domain/constants/transformation-priority";

describe("LOOP_TYPE_DEFINITIONS", () => {
  it("covers every entry in TRANSFORMATION_PRIORITY", () => {
    const prioritySet = new Set(TRANSFORMATION_PRIORITY);
    const missing = [...prioritySet].filter(t => !ALL_DEFINITION_TARGETS.has(t));
    expect(missing).toEqual([]);
  });

  it("contains no targets outside TRANSFORMATION_PRIORITY", () => {
    const prioritySet = new Set(TRANSFORMATION_PRIORITY);
    const orphaned = [...ALL_DEFINITION_TARGETS].filter(t => !prioritySet.has(t));
    expect(orphaned).toEqual([]);
  });

  it("has no duplicate targets across definitions", () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const def of LOOP_TYPE_DEFINITIONS) {
      for (const t of def.targets) {
        if (seen.has(t)) duplicates.push(t);
        seen.add(t);
      }
    }
    expect(duplicates).toEqual([]);
  });

  it("has unique definition ids", () => {
    const ids = LOOP_TYPE_DEFINITIONS.map(d => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has exactly 16 definitions", () => {
    expect(LOOP_TYPE_DEFINITIONS.length).toBe(16);
  });

  it("every definition has at least one target and one component", () => {
    for (const def of LOOP_TYPE_DEFINITIONS) {
      expect(def.targets.length).toBeGreaterThan(0);
      expect(def.components.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/loop-labeler/detection/loop-type-definitions.test.ts`
Expected: 6 tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/loop-labeler/domain/constants/loop-type-definitions.ts tests/unit/loop-labeler/detection/loop-type-definitions.test.ts
git commit -m "feat(loop): add LOOP_TYPE_DEFINITIONS declaration table with bidirectional validation"
```

---

### Task 2: Pipeline Types

**Files:**
- Create: `src/lib/features/loop-labeler/services/implementations/detection/types.ts`

- [ ] **Step 1: Write the pipeline types**

```ts
// src/lib/features/loop-labeler/services/implementations/detection/types.ts

import type { LoopTypeDefinition } from "../../../domain/constants/loop-type-definitions";
import type { ComponentId } from "../../../domain/constants/loop-components";
import type { TransformationIntervals } from "../../../domain/models/label-models";

export interface ComparisonMatrix {
  halvedPairs: Map<string, string[]>;
  quarteredPairs: Map<string, string[]>;
}

export interface UnanimityResult {
  definition: LoopTypeDefinition;
  interval: 2 | 4;
  matches: boolean;
  matchedTarget: string | null;
  direction: "cw" | "ccw" | null;
  beatPairCount: number;
}

export interface MergedMatch {
  definition: LoopTypeDefinition;
  interval: 2 | 4;
  matchedTarget: string;
  direction: "cw" | "ccw" | null;
  isStrict: boolean;
}

export interface RewoundResult {
  isRewound: boolean;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/loop-labeler/services/implementations/detection/types.ts
git commit -m "feat(loop): add pipeline types for detection stages"
```

---

### Task 3: Stage 1 — Compare Beat Pairs

**Files:**
- Create: `src/lib/features/loop-labeler/services/implementations/detection/compare-beat-pairs.ts`

This stage builds the `ComparisonMatrix` by calling `StepComparisonOrchestrator` methods. It wraps existing functionality — the orchestrator already generates halved/quartered beat pairs and compares them.

- [ ] **Step 1: Write the implementation**

```ts
// src/lib/features/loop-labeler/services/implementations/detection/compare-beat-pairs.ts

import type { ExtractedStep } from "../../../domain/models/internal-step-models";
import type { IStepComparisonOrchestrator } from "../../contracts/IStepComparisonOrchestrator";
import type { ComparisonMatrix } from "./types";

export function compareBeatPairs(
  steps: ExtractedStep[],
  orchestrator: IStepComparisonOrchestrator
): ComparisonMatrix {
  const halvedPairs = new Map<string, string[]>();
  const quarteredPairs = new Map<string, string[]>();

  // Halved pairs (interval 2): requires even number of steps
  if (steps.length >= 2 && steps.length % 2 === 0) {
    const halfLength = steps.length / 2;
    for (let i = 0; i < halfLength; i++) {
      const step1 = steps[i]!;
      const step2 = steps[halfLength + i]!;
      const labels = orchestrator.compareStepPair(step1, step2);
      halvedPairs.set(`${step1.stepNumber}-${step2.stepNumber}`, labels);
    }
  }

  // Quartered pairs (interval 4): requires divisible by 4
  if (steps.length >= 4 && steps.length % 4 === 0) {
    const quarterLength = steps.length / 4;
    for (let i = 0; i < steps.length; i++) {
      const step1 = steps[i]!;
      const step2 = steps[(i + quarterLength) % steps.length]!;
      const labels = orchestrator.compareStepPair(step1, step2);
      quarteredPairs.set(`${step1.stepNumber}-${step2.stepNumber}`, labels);
    }
  }

  return { halvedPairs, quarteredPairs };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/loop-labeler/services/implementations/detection/compare-beat-pairs.ts
git commit -m "feat(loop): add Stage 1 — compare-beat-pairs builds ComparisonMatrix"
```

---

### Task 4: Stage 2 — Run Unanimity Checks

**Files:**
- Create: `src/lib/features/loop-labeler/services/implementations/detection/run-unanimity-checks.ts`
- Create: `tests/unit/loop-labeler/detection/run-unanimity-checks.test.ts`

- [ ] **Step 1: Write the unanimity function**

```ts
// src/lib/features/loop-labeler/services/implementations/detection/run-unanimity-checks.ts

import type { LoopTypeDefinition } from "../../../domain/constants/loop-type-definitions";
import type { ComparisonMatrix, UnanimityResult } from "./types";

function extractDirection(target: string): "cw" | "ccw" | null {
  if (target.includes("ccw")) return "ccw";
  if (target.includes("cw")) return "cw";
  return null;
}

function checkUnanimity(
  definition: LoopTypeDefinition,
  pairLabels: Map<string, string[]>,
  interval: 2 | 4
): UnanimityResult {
  const pairCount = pairLabels.size;

  if (pairCount === 0) {
    return {
      definition,
      interval,
      matches: false,
      matchedTarget: null,
      direction: null,
      beatPairCount: 0,
    };
  }

  const allLabelSets = [...pairLabels.values()];

  for (const target of definition.targets) {
    const unanimous = allLabelSets.every(labels => labels.includes(target));
    if (unanimous) {
      return {
        definition,
        interval,
        matches: true,
        matchedTarget: target,
        direction: definition.extractDirection ? extractDirection(target) : null,
        beatPairCount: pairCount,
      };
    }
  }

  return {
    definition,
    interval,
    matches: false,
    matchedTarget: null,
    direction: null,
    beatPairCount: pairCount,
  };
}

export function runUnanimityChecks(
  matrix: ComparisonMatrix,
  definitions: readonly LoopTypeDefinition[]
): UnanimityResult[] {
  const results: UnanimityResult[] = [];

  for (const def of definitions) {
    results.push(checkUnanimity(def, matrix.halvedPairs, 2));
    if (matrix.quarteredPairs.size > 0) {
      results.push(checkUnanimity(def, matrix.quarteredPairs, 4));
    }
  }

  return results;
}
```

- [ ] **Step 2: Write tests**

```ts
// tests/unit/loop-labeler/detection/run-unanimity-checks.test.ts

import { describe, it, expect } from "vitest";
import { runUnanimityChecks } from "$lib/features/loop-labeler/services/implementations/detection/run-unanimity-checks";
import { LOOP_TYPE_DEFINITIONS } from "$lib/features/loop-labeler/domain/constants/loop-type-definitions";
import type { ComparisonMatrix } from "$lib/features/loop-labeler/services/implementations/detection/types";

function makeMatrix(
  halved: Record<string, string[]>,
  quartered: Record<string, string[]> = {}
): ComparisonMatrix {
  return {
    halvedPairs: new Map(Object.entries(halved)),
    quarteredPairs: new Map(Object.entries(quartered)),
  };
}

describe("runUnanimityChecks", () => {
  it("detects unanimous rotated_90_cw at interval 4", () => {
    const matrix = makeMatrix(
      {},
      {
        "1-3": ["rotated_90_cw"],
        "2-4": ["rotated_90_cw"],
        "3-1": ["rotated_90_cw"],
        "4-2": ["rotated_90_cw"],
      }
    );

    const results = runUnanimityChecks(matrix, LOOP_TYPE_DEFINITIONS);
    const rotated4 = results.find(
      r => r.definition.id === "rotated" && r.interval === 4
    );
    expect(rotated4?.matches).toBe(true);
    expect(rotated4?.matchedTarget).toBe("rotated_90_cw");
    expect(rotated4?.direction).toBe("cw");
  });

  it("detects unanimous mirrored at interval 2", () => {
    const matrix = makeMatrix({
      "1-3": ["mirrored", "mirrored_inverted"],
      "2-4": ["mirrored"],
    });

    const results = runUnanimityChecks(matrix, LOOP_TYPE_DEFINITIONS);
    const mirrored2 = results.find(
      r => r.definition.id === "mirrored" && r.interval === 2
    );
    expect(mirrored2?.matches).toBe(true);
    expect(mirrored2?.matchedTarget).toBe("mirrored");
  });

  it("does not match when not unanimous", () => {
    const matrix = makeMatrix({
      "1-3": ["rotated_90_cw"],
      "2-4": ["mirrored"],
    });

    const results = runUnanimityChecks(matrix, LOOP_TYPE_DEFINITIONS);
    const matches = results.filter(r => r.matches);
    expect(matches).toHaveLength(0);
  });

  it("detects swapped_inverted at interval 2", () => {
    const matrix = makeMatrix({
      "1-5": ["swapped_inverted"],
      "2-6": ["swapped_inverted"],
      "3-7": ["swapped_inverted"],
      "4-8": ["swapped_inverted"],
    });

    const results = runUnanimityChecks(matrix, LOOP_TYPE_DEFINITIONS);
    const si = results.find(
      r => r.definition.id === "swapped_inverted" && r.interval === 2
    );
    expect(si?.matches).toBe(true);
  });

  it("extracts ccw direction for rotated_swapped_inverted", () => {
    const matrix = makeMatrix(
      {},
      {
        "1-3": ["rotated_90_ccw_swapped_inverted"],
        "2-4": ["rotated_90_ccw_swapped_inverted"],
        "3-1": ["rotated_90_ccw_swapped_inverted"],
        "4-2": ["rotated_90_ccw_swapped_inverted"],
      }
    );

    const results = runUnanimityChecks(matrix, LOOP_TYPE_DEFINITIONS);
    const rsi = results.find(
      r => r.definition.id === "rotated_swapped_inverted" && r.interval === 4
    );
    expect(rsi?.matches).toBe(true);
    expect(rsi?.direction).toBe("ccw");
  });

  it("does not extract direction for non-rotated types", () => {
    const matrix = makeMatrix({
      "1-3": ["mirrored_swapped"],
      "2-4": ["mirrored_swapped"],
    });

    const results = runUnanimityChecks(matrix, LOOP_TYPE_DEFINITIONS);
    const ms = results.find(
      r => r.definition.id === "mirrored_swapped" && r.interval === 2
    );
    expect(ms?.matches).toBe(true);
    expect(ms?.direction).toBeNull();
  });

  it("returns empty results for empty matrix", () => {
    const matrix = makeMatrix({});
    const results = runUnanimityChecks(matrix, LOOP_TYPE_DEFINITIONS);
    const matches = results.filter(r => r.matches);
    expect(matches).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/loop-labeler/detection/run-unanimity-checks.test.ts`
Expected: 7 tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/loop-labeler/services/implementations/detection/run-unanimity-checks.ts tests/unit/loop-labeler/detection/run-unanimity-checks.test.ts
git commit -m "feat(loop): add Stage 2 — generic unanimity function with tests"
```

---

### Task 5: Stage 3 — Merge Intervals

**Files:**
- Create: `src/lib/features/loop-labeler/services/implementations/detection/merge-intervals.ts`
- Create: `tests/unit/loop-labeler/detection/merge-intervals.test.ts`

- [ ] **Step 1: Write the implementation**

```ts
// src/lib/features/loop-labeler/services/implementations/detection/merge-intervals.ts

import type { UnanimityResult, MergedMatch } from "./types";

export function mergeIntervals(results: UnanimityResult[]): MergedMatch[] {
  const matched = results.filter(r => r.matches);

  // Group by definition id — if same type matches at both intervals, period 4 wins
  const byId = new Map<string, UnanimityResult[]>();
  for (const r of matched) {
    const existing = byId.get(r.definition.id) || [];
    existing.push(r);
    byId.set(r.definition.id, existing);
  }

  const merged: MergedMatch[] = [];
  for (const [, group] of byId) {
    // Prefer interval 4 (more specific) when matched at both
    const best = group.find(r => r.interval === 4) || group[0]!;
    merged.push({
      definition: best.definition,
      interval: best.interval,
      matchedTarget: best.matchedTarget!,
      direction: best.direction,
      isStrict: false,
    });
  }

  return merged;
}
```

- [ ] **Step 2: Write tests**

```ts
// tests/unit/loop-labeler/detection/merge-intervals.test.ts

import { describe, it, expect } from "vitest";
import { mergeIntervals } from "$lib/features/loop-labeler/services/implementations/detection/merge-intervals";
import { LOOP_TYPE_DEFINITIONS } from "$lib/features/loop-labeler/domain/constants/loop-type-definitions";
import type { UnanimityResult } from "$lib/features/loop-labeler/services/implementations/detection/types";

const rotatedDef = LOOP_TYPE_DEFINITIONS.find(d => d.id === "rotated")!;
const swappedDef = LOOP_TYPE_DEFINITIONS.find(d => d.id === "swapped")!;
const mirroredDef = LOOP_TYPE_DEFINITIONS.find(d => d.id === "mirrored")!;

function makeResult(
  def: typeof rotatedDef,
  interval: 2 | 4,
  matches: boolean,
  matchedTarget: string | null = null,
  direction: "cw" | "ccw" | null = null
): UnanimityResult {
  return { definition: def, interval, matches, matchedTarget, direction, beatPairCount: 4 };
}

describe("mergeIntervals", () => {
  it("prefers interval 4 when type matches at both intervals", () => {
    const results: UnanimityResult[] = [
      makeResult(rotatedDef, 2, true, "rotated_180"),
      makeResult(rotatedDef, 4, true, "rotated_90_cw", "cw"),
    ];

    const merged = mergeIntervals(results);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.interval).toBe(4);
    expect(merged[0]!.matchedTarget).toBe("rotated_90_cw");
  });

  it("keeps different types at different intervals", () => {
    const results: UnanimityResult[] = [
      makeResult(rotatedDef, 4, true, "rotated_90_cw", "cw"),
      makeResult(swappedDef, 2, true, "swapped"),
    ];

    const merged = mergeIntervals(results);
    expect(merged).toHaveLength(2);
    expect(merged.find(m => m.definition.id === "rotated")?.interval).toBe(4);
    expect(merged.find(m => m.definition.id === "swapped")?.interval).toBe(2);
  });

  it("filters out non-matches", () => {
    const results: UnanimityResult[] = [
      makeResult(rotatedDef, 2, false),
      makeResult(rotatedDef, 4, false),
      makeResult(mirroredDef, 2, true, "mirrored"),
    ];

    const merged = mergeIntervals(results);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.definition.id).toBe("mirrored");
  });

  it("returns empty for no matches", () => {
    const results: UnanimityResult[] = [
      makeResult(rotatedDef, 2, false),
    ];

    const merged = mergeIntervals(results);
    expect(merged).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/loop-labeler/detection/merge-intervals.test.ts`
Expected: 4 tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/loop-labeler/services/implementations/detection/merge-intervals.ts tests/unit/loop-labeler/detection/merge-intervals.test.ts
git commit -m "feat(loop): add Stage 3 — merge-intervals with precedence resolution"
```

---

### Task 6: Stage 4 — Apply Strict Prefix

**Files:**
- Create: `src/lib/features/loop-labeler/services/implementations/detection/apply-strict-prefix.ts`
- Create: `tests/unit/loop-labeler/detection/apply-strict-prefix.test.ts`

- [ ] **Step 1: Write the implementation**

```ts
// src/lib/features/loop-labeler/services/implementations/detection/apply-strict-prefix.ts

import type { MergedMatch } from "./types";

export function applyStrictPrefix(matches: MergedMatch[]): MergedMatch[] {
  if (matches.length === 1) {
    return [{ ...matches[0]!, isStrict: true }];
  }
  return matches;
}
```

- [ ] **Step 2: Write tests**

```ts
// tests/unit/loop-labeler/detection/apply-strict-prefix.test.ts

import { describe, it, expect } from "vitest";
import { applyStrictPrefix } from "$lib/features/loop-labeler/services/implementations/detection/apply-strict-prefix";
import { LOOP_TYPE_DEFINITIONS } from "$lib/features/loop-labeler/domain/constants/loop-type-definitions";
import type { MergedMatch } from "$lib/features/loop-labeler/services/implementations/detection/types";

const rotatedDef = LOOP_TYPE_DEFINITIONS.find(d => d.id === "rotated")!;
const swappedDef = LOOP_TYPE_DEFINITIONS.find(d => d.id === "swapped")!;
const rotSwapDef = LOOP_TYPE_DEFINITIONS.find(d => d.id === "rotated_swapped")!;

function makeMatch(
  def: typeof rotatedDef,
  interval: 2 | 4,
  matchedTarget: string,
  direction: "cw" | "ccw" | null = null
): MergedMatch {
  return { definition: def, interval, matchedTarget, direction, isStrict: false };
}

describe("applyStrictPrefix", () => {
  it("marks single match as strict", () => {
    const matches = [makeMatch(rotatedDef, 4, "rotated_90_cw", "cw")];
    const result = applyStrictPrefix(matches);
    expect(result).toHaveLength(1);
    expect(result[0]!.isStrict).toBe(true);
  });

  it("does not mark when multiple types match", () => {
    const matches = [
      makeMatch(rotatedDef, 4, "rotated_90_cw", "cw"),
      makeMatch(swappedDef, 2, "swapped"),
    ];
    const result = applyStrictPrefix(matches);
    expect(result.every(m => !m.isStrict)).toBe(true);
  });

  it("marks compound single type as strict", () => {
    const matches = [makeMatch(rotSwapDef, 4, "rotated_90_cw_swapped", "cw")];
    const result = applyStrictPrefix(matches);
    expect(result[0]!.isStrict).toBe(true);
  });

  it("returns empty array unchanged", () => {
    const result = applyStrictPrefix([]);
    expect(result).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/loop-labeler/detection/apply-strict-prefix.test.ts`
Expected: 4 tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/loop-labeler/services/implementations/detection/apply-strict-prefix.ts tests/unit/loop-labeler/detection/apply-strict-prefix.test.ts
git commit -m "feat(loop): add Stage 4 — apply-strict-prefix post-processing"
```

---

### Task 7: Stage 5 — Check Rewound

**Files:**
- Create: `src/lib/features/loop-labeler/services/implementations/detection/check-rewound.ts`

Rewound is orthogonal — always period 2, sequence-level. The second half of the sequence is the first half played in reverse order. This is a simple check: compare step[i] with step[length - 1 - i] for identity.

- [ ] **Step 1: Write the implementation**

```ts
// src/lib/features/loop-labeler/services/implementations/detection/check-rewound.ts

import type { ExtractedStep } from "../../../domain/models/internal-step-models";
import type { RewoundResult } from "./types";

export function checkRewound(steps: ExtractedStep[]): RewoundResult {
  if (steps.length < 2 || steps.length % 2 !== 0) {
    return { isRewound: false };
  }

  const halfLength = steps.length / 2;

  for (let i = 0; i < halfLength; i++) {
    const forward = steps[i]!;
    const reverse = steps[steps.length - 1 - i]!;

    const blueMatch =
      forward.blue.startLoc === reverse.blue.endLoc &&
      forward.blue.endLoc === reverse.blue.startLoc &&
      forward.blue.motionType === reverse.blue.motionType;

    const redMatch =
      forward.red.startLoc === reverse.red.endLoc &&
      forward.red.endLoc === reverse.red.startLoc &&
      forward.red.motionType === reverse.red.motionType;

    if (!blueMatch || !redMatch) {
      return { isRewound: false };
    }
  }

  return { isRewound: true };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/loop-labeler/services/implementations/detection/check-rewound.ts
git commit -m "feat(loop): add Stage 5 — check-rewound orthogonal detection"
```

---

### Task 8: Stage 6 — Build Candidates

**Files:**
- Create: `src/lib/features/loop-labeler/services/implementations/detection/build-candidates.ts`
- Create: `tests/unit/loop-labeler/detection/build-candidates.test.ts`

This stage converts `MergedMatch[]` + `RewoundResult` into `CandidateDesignation[]`. It replaces the old `CandidateFormatter.buildCandidateDesignations` — components and direction come from the definition table, not from string parsing.

- [ ] **Step 1: Write the implementation**

```ts
// src/lib/features/loop-labeler/services/implementations/detection/build-candidates.ts

import type { ComponentId } from "../../../domain/constants/loop-components";
import type {
  CandidateDesignation,
  TransformationIntervals,
} from "../../../domain/models/label-models";
import type { MergedMatch, RewoundResult } from "./types";

function buildDescription(match: MergedMatch): string {
  const parts: string[] = [];

  for (const comp of match.definition.components) {
    switch (comp) {
      case "rotated": {
        const target = match.matchedTarget;
        if (target.includes("90")) {
          const dir = match.direction?.toUpperCase() || "";
          parts.push(`Rotated 90° ${dir}`.trim());
        } else {
          parts.push("Rotated 180°");
        }
        break;
      }
      case "mirrored":
        parts.push("Mirrored");
        break;
      case "flipped":
        parts.push("Flipped");
        break;
      case "swapped":
        parts.push("Swapped");
        break;
      case "inverted":
        parts.push("Inverted");
        break;
      case "repeated":
        parts.push("Repeated");
        break;
    }
  }

  return parts.join(" + ");
}

function buildLabel(match: MergedMatch): string {
  const parts = [...match.definition.components];
  let label = parts.join("+");

  if (match.direction && match.interval === 4) {
    label += ` (${match.direction.toUpperCase()})`;
  }

  const intervalStr = match.interval === 2 ? "@1/2" : "@1/4";
  label += ` ${intervalStr}`;

  if (match.isStrict) {
    label = `strict ${label}`;
  }

  return label;
}

function buildIntervals(matches: MergedMatch[]): TransformationIntervals {
  const intervals: TransformationIntervals = {};

  for (const match of matches) {
    for (const comp of match.definition.components) {
      switch (comp) {
        case "rotated":
          if (!intervals.rotation || match.interval > intervals.rotation)
            intervals.rotation = match.interval;
          break;
        case "swapped":
          if (!intervals.swap || match.interval > intervals.swap)
            intervals.swap = match.interval;
          break;
        case "mirrored":
          if (!intervals.mirror || match.interval > intervals.mirror)
            intervals.mirror = match.interval;
          break;
        case "flipped":
          if (!intervals.flip || match.interval > intervals.flip)
            intervals.flip = match.interval;
          break;
        case "inverted":
          if (!intervals.invert || match.interval > intervals.invert)
            intervals.invert = match.interval;
          break;
      }
    }
  }

  return intervals;
}

export function buildCandidates(
  matches: MergedMatch[],
  rewound: RewoundResult
): CandidateDesignation[] {
  const candidates: CandidateDesignation[] = [];
  const allIntervals = buildIntervals(matches);

  for (const match of matches) {
    const components = [...match.definition.components] as ComponentId[];
    const loopType = match.isStrict
      ? `strict_${match.definition.id}`
      : match.definition.id;

    candidates.push({
      components,
      loopType,
      transformationIntervals: allIntervals,
      label: buildLabel(match),
      description: buildDescription(match),
      rotationDirection: match.direction,
      confirmed: false,
      denied: false,
    });
  }

  if (rewound.isRewound) {
    candidates.push({
      components: ["rewound"],
      loopType: "rewound",
      transformationIntervals: {},
      label: "rewound @1/2",
      description: "Rewound (second half reversed)",
      rotationDirection: null,
      confirmed: false,
      denied: false,
    });
  }

  return candidates;
}
```

- [ ] **Step 2: Write tests**

```ts
// tests/unit/loop-labeler/detection/build-candidates.test.ts

import { describe, it, expect } from "vitest";
import { buildCandidates } from "$lib/features/loop-labeler/services/implementations/detection/build-candidates";
import { LOOP_TYPE_DEFINITIONS } from "$lib/features/loop-labeler/domain/constants/loop-type-definitions";
import type { MergedMatch, RewoundResult } from "$lib/features/loop-labeler/services/implementations/detection/types";

const rotatedDef = LOOP_TYPE_DEFINITIONS.find(d => d.id === "rotated")!;
const mirSwapDef = LOOP_TYPE_DEFINITIONS.find(d => d.id === "mirrored_swapped")!;
const rotSwapInvDef = LOOP_TYPE_DEFINITIONS.find(d => d.id === "rotated_swapped_inverted")!;

const noRewound: RewoundResult = { isRewound: false };

describe("buildCandidates", () => {
  it("builds strict candidate for single match", () => {
    const matches: MergedMatch[] = [{
      definition: rotatedDef,
      interval: 4,
      matchedTarget: "rotated_90_cw",
      direction: "cw",
      isStrict: true,
    }];

    const candidates = buildCandidates(matches, noRewound);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.loopType).toBe("strict_rotated");
    expect(candidates[0]!.components).toEqual(["rotated"]);
    expect(candidates[0]!.rotationDirection).toBe("cw");
    expect(candidates[0]!.transformationIntervals.rotation).toBe(4);
    expect(candidates[0]!.description).toBe("Rotated 90° CW");
  });

  it("adds rewound candidate when rewound detected", () => {
    const matches: MergedMatch[] = [{
      definition: mirSwapDef,
      interval: 2,
      matchedTarget: "mirrored_swapped",
      direction: null,
      isStrict: false,
    }];

    const candidates = buildCandidates(matches, { isRewound: true });
    expect(candidates).toHaveLength(2);
    expect(candidates[1]!.loopType).toBe("rewound");
    expect(candidates[1]!.components).toEqual(["rewound"]);
  });

  it("builds triple compound candidate", () => {
    const matches: MergedMatch[] = [{
      definition: rotSwapInvDef,
      interval: 4,
      matchedTarget: "rotated_90_ccw_swapped_inverted",
      direction: "ccw",
      isStrict: true,
    }];

    const candidates = buildCandidates(matches, noRewound);
    expect(candidates[0]!.loopType).toBe("strict_rotated_swapped_inverted");
    expect(candidates[0]!.components).toEqual(["rotated", "swapped", "inverted"]);
    expect(candidates[0]!.description).toBe("Rotated 90° CCW + Swapped + Inverted");
  });

  it("returns empty for no matches and no rewound", () => {
    const candidates = buildCandidates([], noRewound);
    expect(candidates).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/loop-labeler/detection/build-candidates.test.ts`
Expected: 4 tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/loop-labeler/services/implementations/detection/build-candidates.ts tests/unit/loop-labeler/detection/build-candidates.test.ts
git commit -m "feat(loop): add Stage 6 — build-candidates from MergedMatch to CandidateDesignation"
```

---

### Task 9: Pipeline Composition + Index

**Files:**
- Create: `src/lib/features/loop-labeler/services/implementations/detection/detect-uniform-pattern.ts`
- Create: `src/lib/features/loop-labeler/services/implementations/detection/index.ts`

- [ ] **Step 1: Write the pipeline composition**

```ts
// src/lib/features/loop-labeler/services/implementations/detection/detect-uniform-pattern.ts

import type { ExtractedStep } from "../../../domain/models/internal-step-models";
import type { CandidateDesignation } from "../../../domain/models/label-models";
import type { IStepComparisonOrchestrator } from "../../contracts/IStepComparisonOrchestrator";
import { LOOP_TYPE_DEFINITIONS } from "../../../domain/constants/loop-type-definitions";
import { compareBeatPairs } from "./compare-beat-pairs";
import { runUnanimityChecks } from "./run-unanimity-checks";
import { mergeIntervals } from "./merge-intervals";
import { applyStrictPrefix } from "./apply-strict-prefix";
import { checkRewound } from "./check-rewound";
import { buildCandidates } from "./build-candidates";

export function detectUniformPattern(
  steps: ExtractedStep[],
  orchestrator: IStepComparisonOrchestrator
): CandidateDesignation[] {
  const matrix  = compareBeatPairs(steps, orchestrator);
  const results = runUnanimityChecks(matrix, LOOP_TYPE_DEFINITIONS);
  const merged  = mergeIntervals(results);
  const strict  = applyStrictPrefix(merged);
  const rewound = checkRewound(steps);
  return buildCandidates(strict, rewound);
}
```

- [ ] **Step 2: Write the index**

```ts
// src/lib/features/loop-labeler/services/implementations/detection/index.ts

export { detectUniformPattern } from "./detect-uniform-pattern";
export type {
  ComparisonMatrix,
  UnanimityResult,
  MergedMatch,
  RewoundResult,
} from "./types";
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/loop-labeler/services/implementations/detection/detect-uniform-pattern.ts src/lib/features/loop-labeler/services/implementations/detection/index.ts
git commit -m "feat(loop): add pipeline composition — detectUniformPattern in 6 lines"
```

---

### Task 10: Pipeline Integration Tests (Golden Snapshots)

**Files:**
- Create: `tests/unit/loop-labeler/detection/detect-uniform-pattern.test.ts`

Reuse the existing test fixtures from `LOOPDetector.test.ts` (halved and quartered rotation) but test the pipeline directly. This validates the pipeline produces equivalent results before wiring into LOOPDetector.

- [ ] **Step 1: Write integration tests**

```ts
// tests/unit/loop-labeler/detection/detect-uniform-pattern.test.ts

import { describe, it, expect } from "vitest";
import { detectUniformPattern } from "$lib/features/loop-labeler/services/implementations/detection";
import { stepComparisonOrchestrator } from "$lib/features/loop-labeler/services/implementations/comparison/StepComparisonOrchestrator";
import type { ExtractedStep } from "$lib/features/loop-labeler/domain/models/internal-step-models";

function makeStep(
  num: number,
  bs: string, be: string, bm: string, bp: string,
  rs: string, re: string, rm: string, rp: string
): ExtractedStep {
  return {
    stepNumber: num,
    letter: "A",
    startPos: "alpha1",
    endPos: "alpha1",
    blue: { startLoc: bs, endLoc: be, motionType: bm, propRotDir: bp },
    red: { startLoc: rs, endLoc: re, motionType: rm, propRotDir: rp },
  };
}

describe("detectUniformPattern — pipeline integration", () => {
  it("detects quartered 90° CW rotation", () => {
    const steps: ExtractedStep[] = [
      makeStep(1, "n", "e", "pro", "cw",  "s", "w", "pro", "cw"),
      makeStep(2, "e", "s", "pro", "cw",  "w", "n", "pro", "cw"),
      makeStep(3, "s", "w", "pro", "cw",  "n", "e", "pro", "cw"),
      makeStep(4, "w", "n", "pro", "cw",  "e", "s", "pro", "cw"),
    ];

    const candidates = detectUniformPattern(steps, stepComparisonOrchestrator);
    expect(candidates.length).toBeGreaterThan(0);

    const rotated = candidates.find(c => c.components.includes("rotated"));
    expect(rotated).toBeDefined();
    expect(rotated!.rotationDirection).toBe("cw");
    expect(rotated!.transformationIntervals.rotation).toBe(4);
  });

  it("detects halved 180° rotation", () => {
    const steps: ExtractedStep[] = [
      makeStep(1, "n", "e", "pro", "cw",  "s", "w", "pro", "cw"),
      makeStep(2, "e", "n", "anti", "ccw", "w", "s", "anti", "ccw"),
      makeStep(3, "s", "w", "pro", "cw",  "n", "e", "pro", "cw"),
      makeStep(4, "w", "s", "anti", "ccw", "e", "n", "anti", "ccw"),
    ];

    const candidates = detectUniformPattern(steps, stepComparisonOrchestrator);
    const rotated = candidates.find(c => c.components.includes("rotated"));
    expect(rotated).toBeDefined();
    expect(rotated!.transformationIntervals.rotation).toBe(2);
  });

  it("detects repeated pattern", () => {
    const steps: ExtractedStep[] = [
      makeStep(1, "n", "e", "pro", "cw", "s", "w", "pro", "cw"),
      makeStep(2, "n", "e", "pro", "cw", "s", "w", "pro", "cw"),
    ];

    const candidates = detectUniformPattern(steps, stepComparisonOrchestrator);
    const repeated = candidates.find(c => c.components.includes("repeated"));
    expect(repeated).toBeDefined();
  });

  it("returns empty for non-uniform pattern", () => {
    const steps: ExtractedStep[] = [
      makeStep(1, "n", "e", "pro", "cw",  "s", "w", "pro", "cw"),
      makeStep(2, "n", "s", "pro", "cw",  "s", "n", "pro", "cw"),
    ];

    const candidates = detectUniformPattern(steps, stepComparisonOrchestrator);
    const meaningful = candidates.filter(c => !c.components.includes("rewound"));
    expect(meaningful).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/loop-labeler/detection/detect-uniform-pattern.test.ts`
Expected: 4 tests PASS

- [ ] **Step 3: Commit**

```bash
git add tests/unit/loop-labeler/detection/detect-uniform-pattern.test.ts
git commit -m "test(loop): add pipeline integration tests with golden snapshot fixtures"
```

---

### Task 11: Wire Pipeline into LOOPDetector

**Files:**
- Modify: `src/lib/features/loop-labeler/services/implementations/LOOPDetector.ts`

LOOPDetector's `detectLocationPass` currently calls `detectQuarteredPattern` and `detectHalvedPattern`. Replace those calls with `detectUniformPattern()`. Keep the modular/freeform fallback path unchanged.

The key change: if `detectUniformPattern` returns candidates, build the `LOOPDetectionResult` from them. If it returns empty, fall through to existing `buildFallbackResult`.

- [ ] **Step 1: Add import and wire pipeline at top of `detectLocationPass`**

At the top of `LOOPDetector.ts`, add the import:

```ts
import { detectUniformPattern } from "./detection";
```

Then replace the body of `detectLocationPass` (lines 172–262 of LOOPDetector.ts). The new method:

```ts
  private detectLocationPass(sequence: SequenceEntry): LOOPDetectionResult {
    const circular = this.isCircular(sequence);
    const steps = this.comparisonOrchestrator.extractBeats(sequence);

    const rawSequence = (sequence.fullMetadata?.sequence || []) as Record<
      string,
      unknown
    >[];
    const polyrhythmic: PolyrhythmicLOOPResult =
      this.polyrhythmicService?.detectPolyrhythmic(rawSequence) ?? {
        isPolyrhythmic: false,
        polyrhythm: null,
        periods: [],
        motionPeriod: null,
        spatialPeriod: null,
        description: "Polyrhythmic detection not available",
        confidence: 0,
      };
    const layeredPath: LayeredPathResult =
      this.layeredPathService?.detectLayeredPath(rawSequence) ?? {
        isLayeredPath: false,
        blueCycle: null,
        redCycle: null,
        rhythmType: null,
        polyrhythmRatio: null,
        zoneCoverage: null,
        description: "Layered path detection not available",
        confidence: 0,
      };

    if (!circular || steps.length < 2) {
      return this.buildEmptyResult(circular, polyrhythmic, layeredPath);
    }

    if (steps.length % 2 !== 0) {
      return this.buildFreeformResult(polyrhythmic, layeredPath);
    }

    // === NEW PIPELINE: uniform pattern detection ===
    const candidates = detectUniformPattern(steps, this.comparisonOrchestrator);
    const uniformCandidates = candidates.filter(
      c => !c.components.includes("rewound")
    );
    const rewoundCandidate = candidates.find(
      c => c.components.includes("rewound")
    );

    if (uniformCandidates.length > 0) {
      const primary = uniformCandidates[0]!;
      const allComponents = [...primary.components];
      if (rewoundCandidate) {
        allComponents.push("rewound");
      }

      // Detect rotation direction via orchestrator (for LOOPDetectionResult field)
      let rotationDirection: "cw" | "ccw" | null = null;
      if (steps.length >= 4 && steps.length % 4 === 0) {
        rotationDirection =
          this.comparisonOrchestrator.detectRotationDirection(steps);
      }

      const intervals = primary.transformationIntervals || {};

      // Generate beat pairs for display
      const halvedStepPairs =
        this.comparisonOrchestrator.generateHalvedBeatPairs(steps);
      this.analysisService.reprioritizeBeatPairs(halvedStepPairs);
      const halvedGroups =
        this.analysisService.groupStepPairsByPattern(halvedStepPairs);

      let displayPairs = this.formattingService.toPublicStepPairs(halvedStepPairs);
      let displayGroups = halvedGroups;

      if (steps.length >= 4 && steps.length % 4 === 0) {
        const quarteredStepPairs =
          this.comparisonOrchestrator.generateQuarteredBeatPairs(steps);
        this.analysisService.reprioritizeBeatPairs(quarteredStepPairs);
        displayPairs = this.formattingService.toPublicStepPairs(quarteredStepPairs);
        displayGroups =
          this.analysisService.groupStepPairsByPattern(quarteredStepPairs);
      }

      return {
        loopType: primary.loopType,
        components: allComponents,
        transformationIntervals: intervals,
        rotationDirection: primary.rotationDirection || rotationDirection,
        candidateDesignations: candidates,
        stepPairs: displayPairs,
        stepPairGroups: displayGroups,
        isCircular: true,
        isFreeform: false,
        isModular: false,
        layeredPath,
        isLayeredPath: layeredPath.isLayeredPath,
        polyrhythmic,
        isPolyrhythmic: polyrhythmic.isPolyrhythmic,
        isAxisAlternating: false,
        period: periodFromIntervals(intervals, true),
        componentsDetailed: componentsToDetailed(allComponents as ComponentId[]),
      };
    }

    // === FALLBACK: modular / freeform (unchanged) ===
    const halvedStepPairs =
      this.comparisonOrchestrator.generateHalvedBeatPairs(steps);
    this.analysisService.reprioritizeBeatPairs(halvedStepPairs);
    const halvedStepPairGroups =
      this.analysisService.groupStepPairsByPattern(halvedStepPairs);

    let rotationDirection: "cw" | "ccw" | null = null;
    if (steps.length >= 4 && steps.length % 4 === 0) {
      rotationDirection =
        this.comparisonOrchestrator.detectRotationDirection(steps);
    }

    // Try modular quartered detection
    if (steps.length >= 4 && steps.length % 4 === 0) {
      const quarteredStepPairs =
        this.comparisonOrchestrator.generateQuarteredBeatPairs(steps);
      this.analysisService.reprioritizeBeatPairs(quarteredStepPairs);

      const qLen = Math.floor(steps.length / 4);
      if (qLen > 0 && this.quarteredMotionsConsistent(steps, qLen)) {
        const modularResult = this.detectModularQuarteredPattern(
          quarteredStepPairs,
          rotationDirection,
          polyrhythmic,
          layeredPath
        );
        if (modularResult) {
          this.enrichWithHalvedPrimitives(modularResult, halvedStepPairs);
          return modularResult;
        }
      }
    }

    return this.buildFallbackResult(
      halvedStepPairs,
      halvedStepPairGroups,
      polyrhythmic,
      layeredPath
    );
  }
```

- [ ] **Step 2: Delete superseded methods from LOOPDetector**

Delete these methods — they are fully replaced by the pipeline:
- `detectQuarteredPattern` (lines 264–463)
- `detectHalvedPattern` (lines 579–634)
- `detectCompoundPattern` (lines 465–577)
- `buildCompoundCandidates` (lines 738–775)
- `buildQuarteredIntervals` (lines 777–798)
- `buildCompoundLoopType` (lines 800–808)

Keep these methods — still used by modular fallback:
- `detectModularQuarteredPattern`
- `quarteredMotionsConsistent`
- `enrichWithHalvedPrimitives`
- `buildFallbackResult`
- `buildEmptyResult`
- `buildFreeformResult`

- [ ] **Step 3: Run existing LOOPDetector tests**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/loop-labeler/LOOPDetector.test.ts`
Expected: All 9 existing tests PASS (the facade must produce equivalent results)

- [ ] **Step 4: Run ALL loop-labeler tests**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/loop-labeler/`
Expected: All tests PASS

- [ ] **Step 5: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/loop-labeler/services/implementations/LOOPDetector.ts
git commit -m "feat(loop): wire pipeline into LOOPDetector, delete old uniform detection paths"
```

---

### Task 12: Clean Up CandidateFormatter

**Files:**
- Modify: `src/lib/features/loop-labeler/services/implementations/CandidateFormatter.ts`
- Modify: `src/lib/features/loop-labeler/services/contracts/ICandidateFormatter.ts`

The pipeline's `buildCandidates` stage replaces `buildCandidateDesignations`, `deriveComponentsFromPattern`, `extractRotationDirection`, and `formatCandidateDescription`. These methods are superseded. However, they may still be called by the modular detection fallback path in LOOPDetector. Before deleting, verify.

- [ ] **Step 1: Grep for remaining usages**

Run: `grep -rn "deriveComponentsFromPattern\|extractRotationDirection\|formatCandidateDescription\|buildCandidateDesignations" src/lib/features/loop-labeler/ --include="*.ts" | grep -v "CandidateFormatter.ts" | grep -v "ICandidateFormatter.ts"`

Check which methods are still called. If `deriveComponentsFromPattern` and `extractRotationDirection` are still used in `LOOPDetector.ts` by the modular fallback path, keep them until modular detection is also migrated (out of scope for this spec).

- [ ] **Step 2: Remove methods that have zero remaining callers**

For each method with no remaining callers outside CandidateFormatter itself:
1. Delete the method from `CandidateFormatter.ts`
2. Delete the method signature from `ICandidateFormatter.ts`

For methods still called by the modular path: leave them. Add a comment:
```ts
/** @deprecated Pipeline Stage 6 (build-candidates) supersedes this for uniform detection. Retained for modular fallback path. */
```

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Run all tests**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/loop-labeler/`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/loop-labeler/services/implementations/CandidateFormatter.ts src/lib/features/loop-labeler/services/contracts/ICandidateFormatter.ts
git commit -m "refactor(loop): deprecate/remove superseded CandidateFormatter methods"
```

---

### Task 13: Full Build Verification

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run --config tests/config/vitest.config.ts`
Expected: All tests PASS

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit (if any fixups were needed)**

Only if steps 1-3 required fixes. Otherwise skip.
