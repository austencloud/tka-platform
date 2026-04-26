# Generation Parity Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full parity between MCP and in-app sequence generation through a compositional constraint system and shared engine.

**Architecture:** The shared engine (`packages/sequence-engine/`) becomes the single source of truth for sequence generation. Both MCP server and browser app call `SequenceBuilder.build()` with their own `IVariationProvider` implementations. Constraints are composed from orthogonal dimensions via `buildConstraintSet(options)`. Named presets become aliases. The app's random-walk generator, ad-hoc filters, and duplicate LOOP executors are retired.

**Tech Stack:** TypeScript, Vitest (engine tests), `packages/sequence-engine/`, `mcp-server/`, Svelte 5 app with ITI DI

**Spec:** `docs/superpowers/specs/2026-03-17-generation-parity-design.md`

---

## Task 1: Unify `MotionData` Types

The engine has two incompatible `MotionData` interfaces — one in the constraint layer (has `color`, no `turns`) and one in the core layer (has `turns`, no `color`). Unify to one type.

**Files:**
- Modify: `packages/sequence-engine/src/core/types/sequence-engine-types.ts:111-121` (add `color`)
- Modify: `packages/sequence-engine/src/generation/constraints/types.ts:13-21` (remove `MotionData`, re-export from core)
- Modify: `packages/sequence-engine/tests/integration/full-build.test.ts:21-31` (update `makeMotion`)

- [ ] **Step 1: Add `color` to core `MotionData`**

In `packages/sequence-engine/src/core/types/sequence-engine-types.ts`, add `color?: string` to the `MotionData` interface:

```typescript
export interface MotionData {
  motionType: string;
  startLocation: string;
  endLocation: string;
  rotationDirection: string;
  startOrientation?: string;
  endOrientation?: string;
  turns?: number | "fl";
  plane?: "wall" | "wheel" | "overhead";
  color?: string;
}
```

- [ ] **Step 2: Replace constraint-layer `MotionData` with re-export**

In `packages/sequence-engine/src/generation/constraints/types.ts`, remove the local `MotionData` interface and import from core:

```typescript
// Remove:
// export interface MotionData { ... }

// Add at top:
import type { MotionData } from "../../core/types/sequence-engine-types.js";
export type { MotionData };
```

Update `PictographData` to keep referencing `MotionData` (no change needed — it already does).

- [ ] **Step 3: Run tests to verify nothing broke**

Run: `cd packages/sequence-engine && npx vitest run`
Expected: All existing tests pass. The `makeMotion` helper in `full-build.test.ts` already uses `color`, which is now valid on the unified type.

- [ ] **Step 4: Commit**

```bash
git add packages/sequence-engine/src/core/types/sequence-engine-types.ts packages/sequence-engine/src/generation/constraints/types.ts
git commit -m "refactor(sequence-engine): unify MotionData to single type with color+turns+plane"
```

---

## Task 2: Create `ConstraintOptions` Type and `buildConstraintSet()`

The compositional constraint system. Define the structured options type and the function that converts it into a `ConstraintSet`.

**Files:**
- Create: `packages/sequence-engine/src/generation/constraints/composition/constraint-options.ts`
- Create: `packages/sequence-engine/src/generation/constraints/composition/build-constraint-set.ts`
- Create: `packages/sequence-engine/tests/generation/constraints/composition/build-constraint-set.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/sequence-engine/tests/generation/constraints/composition/build-constraint-set.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildConstraintSet } from "../../../../src/generation/constraints/composition/build-constraint-set.js";
import { ConstraintType } from "../../../../src/generation/constraints/constraint-types.js";

describe("buildConstraintSet", () => {
  it("returns empty constraints for empty options", () => {
    const result = buildConstraintSet({});
    expect(result.hard).toHaveLength(0);
    expect(result.soft).toHaveLength(0);
  });

  it("creates hard MotionType constraint for motionType: 'pro'", () => {
    const result = buildConstraintSet({ motionType: "pro" });
    const motionConstraint = result.hard.find(c => c.type === ConstraintType.MOTION_TYPE);
    expect(motionConstraint).toBeDefined();
    expect(motionConstraint!.mode).toBe("hard");
    expect(motionConstraint!.description).toContain("pro");
  });

  it("creates hard RotationDirection constraint for rotationDirection: 'cw'", () => {
    const result = buildConstraintSet({ rotationDirection: "cw" });
    const rotConstraint = result.hard.find(c => c.type === ConstraintType.ROTATION_DIRECTION);
    expect(rotConstraint).toBeDefined();
    expect(rotConstraint!.mode).toBe("hard");
  });

  it("creates soft ContinuityConstraint for propContinuity: 'maximize'", () => {
    const result = buildConstraintSet({ propContinuity: "maximize" });
    const continuityConstraint = result.soft.find(c => c.type === ConstraintType.CONTINUITY);
    expect(continuityConstraint).toBeDefined();
    expect(continuityConstraint!.mode).toBe("soft");
  });

  it("creates hard ReversalConstraint for propContinuity: 'force-reversals'", () => {
    const result = buildConstraintSet({ propContinuity: "force-reversals" });
    const reversalConstraint = [...result.hard, ...result.soft].find(c => c.type === ConstraintType.REVERSAL);
    expect(reversalConstraint).toBeDefined();
  });

  it("creates exclude constraint for motionFamily.exclude", () => {
    const result = buildConstraintSet({ motionFamily: { exclude: ["dash"] } });
    const motionConstraint = result.hard.find(c => c.type === ConstraintType.MOTION_TYPE);
    expect(motionConstraint).toBeDefined();
    expect(motionConstraint!.description).toContain("Exclude");
    expect(motionConstraint!.description).toContain("dash");
  });

  it("composes multiple dimensions correctly", () => {
    const result = buildConstraintSet({
      motionType: "pro",
      rotationDirection: "ccw",
      propContinuity: "maximize",
    });
    expect(result.hard.length).toBeGreaterThanOrEqual(2); // motionType + rotationDirection
    expect(result.soft.length).toBeGreaterThanOrEqual(1); // propContinuity
  });

  it("skips 'any' values without creating constraints", () => {
    const result = buildConstraintSet({
      motionType: "any",
      rotationDirection: "any",
      turns: "any",
    });
    expect(result.hard).toHaveLength(0);
    expect(result.soft).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/sequence-engine && npx vitest run tests/generation/constraints/composition/build-constraint-set.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create `ConstraintOptions` type**

Create `packages/sequence-engine/src/generation/constraints/composition/constraint-options.ts`:

```typescript
/**
 * Compositional Constraint Options
 *
 * Structured type representing the orthogonal dimensions of constraint.
 * Each field is independent — compose freely. Named presets are aliases
 * that resolve to ConstraintOptions before calling buildConstraintSet().
 */

export interface ConstraintOptions {
  /** Pro, anti, or any motion type. Default: "any" */
  motionType?: "pro" | "anti" | "any";

  /** Clockwise, counter-clockwise, or any. Default: "any" */
  rotationDirection?: "cw" | "ccw" | "any";

  /** Specific turn value or any. Default: "any" */
  turns?: number | "any";

  /** Which motion families to include/exclude (shift, dash, static).
   *  Named "motionFamily" because shift/dash/static are motion types,
   *  not hand path families (cw/ccw/dash/static/hashIn/hashOut). */
  motionFamily?: {
    include?: ("shift" | "dash" | "static")[];
    exclude?: ("shift" | "dash" | "static")[];
  };

  /** Prop spin continuity preference. Default: "any" */
  propContinuity?: "maximize" | "allow-reversals" | "force-reversals";

  /** Hand path continuity preference. Default: "any" */
  handPathContinuity?: "maximize" | "allow-reversals" | "force-reversals";
}
```

- [ ] **Step 4: Implement `buildConstraintSet()`**

Create `packages/sequence-engine/src/generation/constraints/composition/build-constraint-set.ts`:

```typescript
/**
 * Compositional Constraint Builder
 *
 * Single entry point for converting structured ConstraintOptions into a ConstraintSet.
 * All three constraint paths (structured, presets, NL parsing) funnel through here.
 */

import type { ConstraintSet, IConstraint } from "../types.js";
import type { ConstraintOptions } from "./constraint-options.js";
import { MotionTypeConstraint } from "../style/motion-type-constraint.js";
import { RotationDirectionConstraint } from "../style/rotation-direction-constraint.js";
import { ContinuityConstraint } from "../style/continuity-constraint.js";
import { ReversalConstraint } from "../style/reversal-constraint.js";
import {
  HandPathReversalConstraint,
  maximizeHandPathContinuity,
} from "../style/hand-path-constraint.js";
// TurnConstraint import added in Task 3 after it exists
// import { TurnConstraint } from "../style/turn-constraint.js";

export function buildConstraintSet(options: ConstraintOptions): ConstraintSet {
  const hard: IConstraint[] = [];
  const soft: IConstraint[] = [];

  // Motion type dimension
  if (options.motionType && options.motionType !== "any") {
    hard.push(
      new MotionTypeConstraint({
        motionType: options.motionType,
        hand: "both",
        mode: "require",
      })
    );
  }

  // Rotation direction dimension
  if (options.rotationDirection && options.rotationDirection !== "any") {
    hard.push(
      new RotationDirectionConstraint({
        direction: options.rotationDirection,
        hand: "both",
        mode: "require",
      })
    );
  }

  // Turn value dimension (TurnConstraint added in Task 3 — skip this branch until then)
  // if (options.turns !== undefined && options.turns !== "any") {
  //   hard.push(new TurnConstraint(options.turns));
  // }

  // Motion family include/exclude
  if (options.motionFamily) {
    if (options.motionFamily.exclude) {
      for (const family of options.motionFamily.exclude) {
        hard.push(
          new MotionTypeConstraint({
            motionType: family,
            hand: "both",
            mode: "exclude",
          })
        );
      }
    }
    if (options.motionFamily.include) {
      // "include: ['shift']" means exclude everything EXCEPT shift
      const allFamilies: ("shift" | "dash" | "static")[] = ["shift", "dash", "static"];
      const excluded = allFamilies.filter(f => !options.motionFamily!.include!.includes(f));
      for (const family of excluded) {
        hard.push(
          new MotionTypeConstraint({
            motionType: family,
            hand: "both",
            mode: "exclude",
          })
        );
      }
    }
  }

  // Prop continuity dimension
  if (options.propContinuity) {
    switch (options.propContinuity) {
      case "maximize":
        soft.push(new ContinuityConstraint("maximize"));
        break;
      case "force-reversals":
        soft.push(new ReversalConstraint("every"));
        break;
      case "allow-reversals":
        // No constraint — allow whatever happens naturally
        break;
    }
  }

  // Hand path continuity dimension
  if (options.handPathContinuity) {
    switch (options.handPathContinuity) {
      case "maximize":
        soft.push(maximizeHandPathContinuity());
        break;
      case "force-reversals":
        soft.push(new HandPathReversalConstraint("every"));
        break;
      case "allow-reversals":
        break;
    }
  }

  return { hard, soft };
}
```

- [ ] **Step 5: Run tests**

Run: `cd packages/sequence-engine && npx vitest run tests/generation/constraints/composition/build-constraint-set.test.ts`
Expected: All pass. The `turns` branch is commented out — Task 3 will uncomment it after creating `TurnConstraint`.

- [ ] **Step 6: Commit**

```bash
git add packages/sequence-engine/src/generation/constraints/composition/ packages/sequence-engine/tests/generation/constraints/composition/
git commit -m "feat(sequence-engine): add compositional buildConstraintSet with ConstraintOptions"
```

---

## Task 3: Create `TurnConstraint`

New constraint class that filters variations by turn value. Required for `isolation` preset (`turns: 0`).

**Files:**
- Create: `packages/sequence-engine/src/generation/constraints/style/turn-constraint.ts`
- Create: `packages/sequence-engine/tests/generation/constraints/style/turn-constraint.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/sequence-engine/tests/generation/constraints/style/turn-constraint.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { TurnConstraint } from "../../../../src/generation/constraints/style/turn-constraint.js";
import type { ConstraintContext, PictographData } from "../../../../src/generation/constraints/types.js";

function makeCandidate(blueTurns?: number | "fl", redTurns?: number | "fl"): ConstraintContext {
  return {
    stepIndex: 0,
    totalSteps: 4,
    previousSteps: [],
    letter: "A",
    candidate: {
      letter: "A",
      startPosition: "alpha1",
      endPosition: "beta3",
      timing: "together",
      direction: "together",
      blueMotion: {
        motionType: "pro",
        startLocation: "n",
        endLocation: "s",
        rotationDirection: "cw",
        turns: blueTurns,
      },
      redMotion: {
        motionType: "pro",
        startLocation: "s",
        endLocation: "n",
        rotationDirection: "ccw",
        turns: redTurns,
      },
    },
  };
}

describe("TurnConstraint", () => {
  it("satisfies when both hands match required turns", () => {
    const constraint = new TurnConstraint(0);
    const result = constraint.evaluate(makeCandidate(0, 0));
    expect(result.satisfied).toBe(true);
    expect(result.score).toBe(1);
  });

  it("rejects when turns don't match", () => {
    const constraint = new TurnConstraint(0);
    const result = constraint.evaluate(makeCandidate(1, 0));
    expect(result.satisfied).toBe(false);
  });

  it("treats undefined turns as 0", () => {
    const constraint = new TurnConstraint(0);
    const result = constraint.evaluate(makeCandidate(undefined, undefined));
    expect(result.satisfied).toBe(true);
  });

  it("rejects float turns when requiring 0", () => {
    const constraint = new TurnConstraint(0);
    const result = constraint.evaluate(makeCandidate("fl", 0));
    expect(result.satisfied).toBe(false);
  });

  it("is always a hard constraint", () => {
    const constraint = new TurnConstraint(0);
    expect(constraint.mode).toBe("hard");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/sequence-engine && npx vitest run tests/generation/constraints/style/turn-constraint.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `TurnConstraint`**

Create `packages/sequence-engine/src/generation/constraints/style/turn-constraint.ts`:

```typescript
/**
 * Turn Constraint
 *
 * Filters variations by their turn value. Hard constraint — if you
 * ask for zero turns, you get zero turns. Required for the "isolation"
 * preset (pro shift at zero turns).
 */

import { ConstraintType, type ConstraintMode } from "../constraint-types.js";
import type {
  IVariationConstraint,
  ConstraintContext,
  ConstraintScore,
  PictographData,
} from "../types.js";

export class TurnConstraint implements IVariationConstraint {
  readonly type = ConstraintType.TURN;
  readonly mode: ConstraintMode = "hard";
  readonly description: string;

  constructor(private readonly requiredTurns: number) {
    this.description = `Require ${requiredTurns} turn(s) for both hands`;
  }

  evaluate(context: ConstraintContext): ConstraintScore {
    return this.evaluateVariation(context.candidate);
  }

  couldSatisfy(candidate: PictographData): boolean {
    return this.checkMatch(candidate);
  }

  private evaluateVariation(candidate: PictographData): ConstraintScore {
    const blueTurns = candidate.blueMotion.turns ?? 0;
    const redTurns = candidate.redMotion.turns ?? 0;

    const blueMatch = blueTurns === this.requiredTurns;
    const redMatch = redTurns === this.requiredTurns;
    const satisfied = blueMatch && redMatch;

    let reason: string;
    if (satisfied) {
      reason = `Both hands have ${this.requiredTurns} turn(s)`;
    } else if (!blueMatch && !redMatch) {
      reason = `Blue has ${blueTurns}, red has ${redTurns} (need ${this.requiredTurns})`;
    } else {
      const failing = blueMatch ? "red" : "blue";
      const actual = blueMatch ? redTurns : blueTurns;
      reason = `${failing} has ${actual} turn(s) (need ${this.requiredTurns})`;
    }

    return { score: satisfied ? 1 : 0, satisfied, reason };
  }

  private checkMatch(candidate: PictographData): boolean {
    const blueTurns = candidate.blueMotion.turns ?? 0;
    const redTurns = candidate.redMotion.turns ?? 0;
    return blueTurns === this.requiredTurns && redTurns === this.requiredTurns;
  }
}
```

- [ ] **Step 4: Add `TURN` to `ConstraintType` enum**

In `packages/sequence-engine/src/generation/constraints/constraint-types.ts`, add:

```typescript
export enum ConstraintType {
  // ... existing entries ...
  TURN = "turn",
}
```

And add to `CONSTRAINT_CATEGORIES`:

```typescript
[ConstraintType.TURN]: ConstraintCategory.MOTION,
```

- [ ] **Step 5: Run tests**

Run: `cd packages/sequence-engine && npx vitest run tests/generation/constraints/style/turn-constraint.test.ts`
Expected: All pass

- [ ] **Step 6: Wire `TurnConstraint` into `buildConstraintSet`**

In `packages/sequence-engine/src/generation/constraints/composition/build-constraint-set.ts`:
1. Add import: `import { TurnConstraint } from "../style/turn-constraint.js";`
2. Uncomment the turns branch:
```typescript
  if (options.turns !== undefined && options.turns !== "any") {
    hard.push(new TurnConstraint(options.turns));
  }
```

- [ ] **Step 7: Run full engine test suite**

Run: `cd packages/sequence-engine && npx vitest run`
Expected: All pass (both TurnConstraint and buildConstraintSet tests)

- [ ] **Step 8: Commit**

```bash
git add packages/sequence-engine/src/generation/constraints/style/turn-constraint.ts packages/sequence-engine/src/generation/constraints/constraint-types.ts packages/sequence-engine/src/generation/constraints/composition/build-constraint-set.ts packages/sequence-engine/tests/generation/constraints/style/
git commit -m "feat(sequence-engine): add TurnConstraint and wire into buildConstraintSet"
```

---

## Task 4: Replace Presets with Compositional Aliases

> **IMPORTANT:** Tasks 4, 5, and 6 must be implemented together. Task 4 changes preset names (removes `pro-cw`, `anti-ccw`), Task 5 updates `SequenceBuilder` to use the new system, and Task 6 updates the MCP tools. The MCP server will break at runtime between Tasks 4 and 6 if deployed separately.

Redefine named presets as `ConstraintOptions` objects that resolve through `buildConstraintSet()`.

**Files:**
- Modify: `packages/sequence-engine/src/generation/constraints/presets/preset-constraints.ts` (rewrite)
- Create: `packages/sequence-engine/tests/generation/constraints/presets/preset-aliases.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/sequence-engine/tests/generation/constraints/presets/preset-aliases.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { getPresetConstraintSet, listPresets, getPresetOptions } from "../../../../src/generation/constraints/presets/preset-constraints.js";
import { ConstraintType } from "../../../../src/generation/constraints/constraint-types.js";

describe("preset aliases", () => {
  it("smooth creates continuity + hand path continuity soft constraints", () => {
    const set = getPresetConstraintSet("smooth")!;
    expect(set.hard).toHaveLength(0);
    expect(set.soft.some(c => c.type === ConstraintType.CONTINUITY)).toBe(true);
    expect(set.soft.some(c => c.type === ConstraintType.HAND_PATH)).toBe(true);
  });

  it("isolation creates pro + turn:0 + exclude-dash + exclude-static hard constraints", () => {
    const set = getPresetConstraintSet("isolation")!;
    const motionTypes = set.hard.filter(c => c.type === ConstraintType.MOTION_TYPE);
    const turnConstraints = set.hard.filter(c => c.type === ConstraintType.TURN);
    expect(motionTypes.length).toBeGreaterThanOrEqual(1); // pro require + dash/static exclude
    expect(turnConstraints).toHaveLength(1);
  });

  it("getPresetOptions returns ConstraintOptions for a preset", () => {
    const options = getPresetOptions("smooth");
    expect(options).toBeDefined();
    expect(options!.propContinuity).toBe("maximize");
    expect(options!.handPathContinuity).toBe("maximize");
  });

  it("listPresets returns all preset names with descriptions", () => {
    const presets = listPresets();
    expect(presets.length).toBeGreaterThanOrEqual(9);
    expect(presets.some(p => p.name === "smooth")).toBe(true);
    expect(presets.some(p => p.name === "isolation")).toBe(true);
  });

  it("pro-cw and anti-ccw are removed as dedicated presets", () => {
    expect(getPresetConstraintSet("pro-cw")).toBeNull();
    expect(getPresetConstraintSet("anti-ccw")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/sequence-engine && npx vitest run tests/generation/constraints/presets/preset-aliases.test.ts`
Expected: FAIL — `getPresetOptions` not found, old presets still exist

- [ ] **Step 3: Rewrite `preset-constraints.ts`**

Replace the contents of `packages/sequence-engine/src/generation/constraints/presets/preset-constraints.ts`:

```typescript
/**
 * Preset Constraints — Compositional Aliases
 *
 * Named presets are aliases for ConstraintOptions objects.
 * All presets resolve through buildConstraintSet() for consistency.
 * Users can compose arbitrary combinations directly via ConstraintOptions
 * — presets are just convenient shortcuts.
 */

import type { ConstraintSet } from "../types.js";
import type { ConstraintOptions } from "../composition/constraint-options.js";
import { buildConstraintSet } from "../composition/build-constraint-set.js";

export type PresetName =
  | "smooth"
  | "smooth-hands"
  | "smooth-props"
  | "reversal"
  | "maximum-chaos"
  | "isolation"
  | "antispin"
  | "no-dash"
  | "no-static"
  | "maximize-dash";

interface PresetDefinition {
  name: PresetName;
  description: string;
  options: ConstraintOptions;
}

const PRESETS: PresetDefinition[] = [
  {
    name: "smooth",
    description: "Maximize overall flow — minimize both hand path and prop reversals",
    options: { propContinuity: "maximize", handPathContinuity: "maximize" },
  },
  {
    name: "smooth-hands",
    description: "Maximize hand path continuity — allow prop reversals if hand paths stay smooth",
    options: { handPathContinuity: "maximize" },
  },
  {
    name: "smooth-props",
    description: "Maximize prop spin continuity — allow hand path reversals if prop spins stay consistent",
    options: { propContinuity: "maximize" },
  },
  {
    name: "reversal",
    description: "Maximize prop reversals — as many direction changes as the word allows",
    options: { propContinuity: "force-reversals" },
  },
  {
    name: "maximum-chaos",
    description: "Maximize all reversals (hand path + prop) — as chaotic as the word allows",
    options: { propContinuity: "force-reversals", handPathContinuity: "force-reversals" },
  },
  {
    name: "isolation",
    description: "Pro shifts at zero turns — props appear stationary as hands move",
    options: { motionType: "pro", turns: 0, motionFamily: { include: ["shift"] } },
  },
  {
    name: "antispin",
    description: "All anti motions with smooth prop continuity",
    options: { motionType: "anti", propContinuity: "maximize" },
  },
  {
    name: "no-dash",
    description: "Exclude dash motions — shifts and statics only",
    options: { motionFamily: { exclude: ["dash"] } },
  },
  {
    name: "no-static",
    description: "Exclude static motions — shifts and dashes only",
    options: { motionFamily: { exclude: ["static"] } },
  },
  {
    name: "maximize-dash",
    description: "Prefer dash motions — one hand stays while the other moves",
    // NOTE: This uses DashPreferenceConstraint directly (soft scoring preference),
    // not motionFamily.include which would hard-exclude shifts and statics.
    // buildConstraintSet doesn't cover this case — wire manually in getPresetConstraintSet().
    options: { motionFamily: { include: ["dash"] } },  // TODO: Replace with soft DashPreference
  },
];

export function getPreset(name: string): PresetDefinition | null {
  return PRESETS.find((p) => p.name === name) ?? null;
}

export function getPresetOptions(name: string): ConstraintOptions | null {
  return getPreset(name)?.options ?? null;
}

export function getPresetConstraintSet(name: string): ConstraintSet | null {
  const preset = getPreset(name);
  if (!preset) return null;
  return buildConstraintSet(preset.options);
}

export function listPresetNames(): PresetName[] {
  return PRESETS.map((p) => p.name);
}

export function listPresets(): Array<{ name: string; description: string }> {
  return PRESETS.map((p) => ({ name: p.name, description: p.description }));
}
```

- [ ] **Step 4: Run tests**

Run: `cd packages/sequence-engine && npx vitest run`
Expected: All pass (including full-build integration tests — they use `getPresetConstraintSet("smooth")`)

- [ ] **Step 5: Commit**

```bash
git add packages/sequence-engine/src/generation/constraints/presets/preset-constraints.ts packages/sequence-engine/tests/generation/constraints/presets/
git commit -m "feat(sequence-engine): replace enumerated presets with compositional aliases"
```

---

## Task 5: Wire `SequenceBuilder` to Compositional System

Update `SequenceBuilder.assembleConstraints()` to use `buildConstraintSet()` and accept the new `constraintOptions` field on `BuildOptions`.

**Files:**
- Modify: `packages/sequence-engine/src/generation/builder/SequenceBuilder.ts:44-74` (add `constraintOptions` to `BuildOptions`)
- Modify: `packages/sequence-engine/src/generation/builder/SequenceBuilder.ts:190-231` (rewrite `assembleConstraints`)

- [ ] **Step 1: Add `constraintOptions` to `BuildOptions`**

In `packages/sequence-engine/src/generation/builder/SequenceBuilder.ts`, add the field:

```typescript
import type { ConstraintOptions } from "../constraints/composition/constraint-options.js";

export interface BuildOptions {
  word: string;  // stays required for now, Task 8 makes it optional
  gridMode: string;
  level: number;
  constraintPreset?: string;
  constraints?: string;
  constraintOptions?: ConstraintOptions;  // NEW
  startPosition?: string;
  propType?: string;
  beamWidth?: number;
  maxTurnIntensity?: number;
  loop?: LoopOptions;
}
```

- [ ] **Step 2: Update `assembleConstraints` to use `buildConstraintSet`**

Replace the style constraints section of `assembleConstraints()`:

```typescript
import { buildConstraintSet } from "../constraints/composition/build-constraint-set.js";
import { getPresetOptions } from "../constraints/presets/preset-constraints.js";

private assembleConstraints(options: BuildOptions): ConstraintSet {
  // Always-on domain hard constraints
  const hard: IConstraint[] = [
    new Type6Constraint(),
    new PositionContinuityConstraint(),
    new FloatConstraint(),
  ];

  if (options.propType) {
    hard.push(new PropTypeConstraint());
  }

  let soft: IConstraint[] = [];

  // Style constraints — all three paths resolve through buildConstraintSet
  let styleSet: ConstraintSet | undefined;

  if (options.constraintOptions) {
    styleSet = buildConstraintSet(options.constraintOptions);
  } else if (options.constraintPreset) {
    const presetOptions = getPresetOptions(options.constraintPreset);
    if (presetOptions) {
      styleSet = buildConstraintSet(presetOptions);
    }
  } else if (options.constraints) {
    // NL parsing still goes through legacy path for now
    const { constraintSet: parsedSet } = parseConstraintSet(options.constraints);
    styleSet = parsedSet;
  }

  if (styleSet) {
    hard.push(...styleSet.hard);
    soft.push(...styleSet.soft);
  }

  // Preserve weights from style constraints if present
  const weights = styleSet?.weights;
  return { hard, soft, weights };
}
```

- [ ] **Step 3: Run full test suite**

Run: `cd packages/sequence-engine && npx vitest run`
Expected: All pass

- [ ] **Step 4: Commit**

```bash
git add packages/sequence-engine/src/generation/builder/SequenceBuilder.ts
git commit -m "feat(sequence-engine): wire SequenceBuilder to compositional buildConstraintSet"
```

---

## Task 6: Update MCP Tools to Use Compositional System

The MCP server is the only current consumer. Update its constraint resolution to use `buildConstraintSet()` / `getPresetOptions()`.

**Files:**
- Modify: `mcp-server/src/tools/sequence-tools.ts`
- Modify: `mcp-server/src/tools/preset-tools.ts`

- [ ] **Step 1: Verify current MCP imports from engine**

Read `mcp-server/src/tools/sequence-tools.ts` and `mcp-server/src/tools/preset-tools.ts` to confirm which engine functions they import.

- [ ] **Step 2: Update `sequence-tools.ts`**

Replace any direct `getPresetConstraintSet()` calls with the new flow. The key change: if a user passes `constraintPreset`, resolve it via `getPresetOptions()` then pass as `constraintOptions` to the builder. If they pass `constraints` (NL string), let the builder handle it.

Since `SequenceBuilder.assembleConstraints()` already handles all three paths (from Task 5), the MCP tools should just pass the options through to `BuildOptions` without pre-resolving.

- [ ] **Step 3: Update `preset-tools.ts`**

Update `listPresets()` usage — the return type now includes `name` and `description` (unchanged), but `getPresetConstraintSet` signature changed. Verify preset-tools still works.

- [ ] **Step 4: Build the MCP server to verify no type errors**

Run: `cd mcp-server && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add mcp-server/src/tools/sequence-tools.ts mcp-server/src/tools/preset-tools.ts
git commit -m "feat(mcp): update tools to use compositional constraint system"
```

---

## Task 7: Port 3 Complementary LOOP Executors to Engine

The app has 3 "Complementary" LOOP executors not in the shared engine. Port them.

**Files:**
- Read: `src/lib/features/create/generate/circular/services/implementations/SwappedComplementaryLOOPExecutor.ts`
- Read: `src/lib/features/create/generate/circular/services/implementations/MirroredRotatedComplementaryLOOPExecutor.ts`
- Read: `src/lib/features/create/generate/circular/services/implementations/MirroredRotatedComplementarySwappedLOOPExecutor.ts`
- Create: 3 new executor files in `packages/sequence-engine/src/loop/execution/`
- Modify: `packages/sequence-engine/src/loop/loop-types.ts` (add enum values)
- Modify: `packages/sequence-engine/src/loop/execution/LOOPExecutorSelector.ts` (register new executors)

- [ ] **Step 1: Read all 3 app-side Complementary executors**

Understand the transformation logic of each. Map from app types (`StepData`, `MotionData`, `MotionColor`, etc.) to engine types (`SequenceStep`, `MotionData`).

- [ ] **Step 2: Add `LOOPType` enum values**

In `packages/sequence-engine/src/loop/loop-types.ts`, add:

```typescript
SWAPPED_COMPLEMENTARY = "swapped_complementary",
MIRRORED_ROTATED_COMPLEMENTARY = "mirrored_rotated_complementary",
MIRRORED_ROTATED_COMPLEMENTARY_SWAPPED = "mirrored_rotated_complementary_swapped",
```

Also add labels, descriptions, and include in `ALL_LOOP_TYPES`.

- [ ] **Step 3: Port each executor**

Create engine-side executors in `packages/sequence-engine/src/loop/execution/`:
- `SwappedComplementaryExecutor.ts`
- `MirroredRotatedComplementaryExecutor.ts`
- `MirroredRotatedComplementarySwappedExecutor.ts`

Each executor implements `ILOOPExecutor` and ports the transformation logic using engine types.

- [ ] **Step 4: Register in `LOOPExecutorSelector`**

Add the 3 new executors to the selector's registry.

> **Pre-existing issue:** `MirroredSwappedInvertedExecutor` is imported in `LOOPExecutorSelector.ts` but may not be mapped in the executor registry. Verify during this step and fix if needed.

- [ ] **Step 5: Run engine tests**

Run: `cd packages/sequence-engine && npx vitest run`
Expected: All pass

- [ ] **Step 6: Commit**

```bash
git add packages/sequence-engine/src/loop/
git commit -m "feat(sequence-engine): port 3 Complementary LOOP executors from app"
```

---

## Task 8: Add Length-Based Generation Mode

Make `word` optional in `BuildOptions` and add `length`-based generation where random letters are selected per beat.

**Files:**
- Modify: `packages/sequence-engine/src/generation/builder/SequenceBuilder.ts` (`word` optional, add `length`, `endPosition`, `mustContainLetters`, `mustNotContainLetters`)
- Modify: `packages/sequence-engine/src/generation/builder/BeamSearch.ts` (add open-ended letter selection mode)
- Create: `packages/sequence-engine/tests/generation/builder/length-based.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/sequence-engine/tests/generation/builder/length-based.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { SequenceBuilder } from "../../../src/generation/builder/SequenceBuilder.js";
// ... mock provider setup (reuse from full-build.test.ts pattern)

describe("length-based generation", () => {
  it("generates a sequence of exactly N beats when length is provided", () => {
    const builder = new SequenceBuilder(mockProvider);
    const result = builder.build({
      length: 4,
      gridMode: "diamond",
      level: 1,
    });
    // sequence includes start position + 4 beats
    expect(result.sequence).toHaveLength(5);
  });

  it("throws if neither word nor length is provided", () => {
    const builder = new SequenceBuilder(mockProvider);
    expect(() => builder.build({ gridMode: "diamond", level: 1 })).toThrow();
  });

  it("produces no bridge letters in length-based mode", () => {
    const builder = new SequenceBuilder(mockProvider);
    const result = builder.build({ length: 4, gridMode: "diamond", level: 1 });
    expect(result.bridgeStepIndices).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/sequence-engine && npx vitest run tests/generation/builder/length-based.test.ts`
Expected: FAIL

- [ ] **Step 3: Make `word` optional in `BuildOptions`**

```typescript
export interface BuildOptions {
  /** The word to spell. Either word or length must be provided. */
  word?: string;
  /** Number of beats to generate. Either word or length must be provided. */
  length?: number;
  /** End position constraint (user-specified or LOOP-required) */
  endPosition?: string;
  /** Letters that must appear in the sequence */
  mustContainLetters?: string[];
  /** Letters that must NOT appear in the sequence */
  mustNotContainLetters?: string[];
  // ... rest unchanged
}
```

- [ ] **Step 4: Update `SequenceBuilder.build()` to handle length mode**

Add validation at the top of `build()`:

```typescript
if (!options.word && !options.length) {
  throw new Error("Either word or length must be provided");
}
```

When `length` is provided without `word`, skip letter parsing and use a different beam search mode that selects random available letters at each step.

- [ ] **Step 5: Add open-ended letter selection to `BeamSearch`**

The beam search needs a mode where instead of placing a specific letter, it queries `variationProvider.getAllVariations()` filtered by current position, then scores all candidates. This is the "pick best next beat" path.

- [ ] **Step 6: Run tests**

Run: `cd packages/sequence-engine && npx vitest run`
Expected: All pass

- [ ] **Step 7: Commit**

```bash
git add packages/sequence-engine/src/generation/builder/ packages/sequence-engine/tests/generation/builder/
git commit -m "feat(sequence-engine): add length-based generation mode with open-ended letter selection"
```

---

## Task 9: Complete LOOP Integration in `SequenceBuilder`

Wire the `extendWithLOOP()` stub to the actual LOOP execution pipeline.

> **Type strategy:** The LOOP executors currently operate on `PictographData[]`. Rather than refactoring all 18 executors to accept `SequenceStep[]` (high disruption), convert `SequenceStep[]` → `PictographData[]` at the `extendWithLOOP` boundary, run executors, then convert back. This is localized and practical. A full executor type migration can happen later if warranted.

**Files:**
- Modify: `packages/sequence-engine/src/generation/builder/SequenceBuilder.ts:303-322` (replace stub)
- Modify: `packages/sequence-engine/src/loop/loop-types.ts` (use `LOOPType` and `SliceSize` enums in `LoopOptions`)
- Create: `packages/sequence-engine/tests/generation/builder/loop-extension.test.ts`

- [ ] **Step 1: Update `LoopOptions` to use proper union types**

In `SequenceBuilder.ts`, change:

```typescript
export interface LoopOptions {
  type: LOOPType;          // was: string
  sliceSize: SliceSize;    // was: string
  useTargetedGeneration?: boolean;
}
```

Import `LOOPType` and `SliceSize` from `../../loop/loop-types.js`.

- [ ] **Step 2: Implement `extendWithLOOP()`**

Replace the stub with actual wiring:

```typescript
private extendWithLOOP(result: BuildResult, loopOptions: LoopOptions): BuildResult {
  // 1. Select executor via LOOPExecutorSelector
  const executorSelector = new LOOPExecutorSelector();
  const executor = executorSelector.getExecutor(loopOptions.type);

  // 2. Convert SequenceStep[] to format executors expect
  // 3. Execute LOOP transformation
  const extended = executor.executeLOOP(result.sequence, loopOptions.sliceSize);

  // 4. Re-derive letters from transformed motions via LetterLookup
  // 5. Build LOOP metadata (derived word, components, cycle multiplier)
  // 6. Return extended BuildResult
}
```

- [ ] **Step 3: Wire end-position constraint for seed generation**

When LOOP options are present, the seed sequence must end at the position required by the LOOP type. Use the `LOOPEndPositionSelector` from the engine's loop layer to determine the required end position, then pass it as a constraint during beam search.

- [ ] **Step 4: Wire letter re-derivation**

After LOOP transformation, use the engine's `LetterLookup` to re-derive letters from transformed motions (same purpose as the app's `rederiveLettersFromMotions()`).

- [ ] **Step 5: Write LOOP extension test**

Create `packages/sequence-engine/tests/generation/builder/loop-extension.test.ts`. This is a silent-corruption risk — LOOP executors can produce wrong letters. Test:

```typescript
import { describe, it, expect } from "vitest";
import { SequenceBuilder } from "../../../src/generation/builder/SequenceBuilder.js";
// ... mock provider with enough variations to build a 2-letter seed

describe("LOOP extension", () => {
  it("produces a circular sequence where last beat ends at start position", () => {
    const builder = new SequenceBuilder(mockProvider);
    const result = builder.build({
      word: "AB",
      gridMode: "diamond",
      level: 1,
      constraintOptions: { propContinuity: "maximize" },
      loop: { type: LOOPType.ROTATED, sliceSize: SliceSize.HALVED },
    });
    const lastStep = result.sequence[result.sequence.length - 1]!;
    const startStep = result.sequence[0]!;
    expect(lastStep.endPosition).toBe(startStep.startPosition);
  });

  it("includes LOOP metadata in result", () => {
    // ... verify result.loop is populated with seedWord, derivedWord, etc.
  });
});
```

- [ ] **Step 6: Run full test suite**

Run: `cd packages/sequence-engine && npx vitest run`
Expected: All pass

- [ ] **Step 7: Commit**

```bash
git add packages/sequence-engine/src/generation/builder/SequenceBuilder.ts packages/sequence-engine/tests/generation/builder/loop-extension.test.ts
git commit -m "feat(sequence-engine): wire extendWithLOOP to actual LOOP execution pipeline"
```

---

## Task 10: Create `BrowserVariationProvider`

Implement `IVariationProvider` for the browser app. Owns CSV loading, parsing, and indexed lookup.

**Files:**
- Create: `src/lib/shared/pictograph/shared/services/implementations/BrowserVariationProvider.ts`
- Create: `src/lib/shared/pictograph/shared/services/contracts/IBrowserVariationProvider.ts`
- Modify: `src/lib/shared/di/containers/data-container.ts` (register provider)
- Modify: `src/lib/shared/di/container-types.ts` (add type)

- [ ] **Step 1: Define the interface**

Create `src/lib/shared/pictograph/shared/services/contracts/IBrowserVariationProvider.ts`:

```typescript
import type { IVariationProvider } from "@tka/sequence-engine/generation/data/IVariationProvider";

export interface IBrowserVariationProvider extends IVariationProvider {
  initialize(gridMode: string): Promise<void>;
  isInitialized(): boolean;
}
```

- [ ] **Step 2: Implement the provider**

Create `src/lib/shared/pictograph/shared/services/implementations/BrowserVariationProvider.ts`:

The provider:
1. Takes the existing CSV loader/parser dependencies (from DI)
2. On `initialize()`, loads all CSV data and builds the `letter:position` index
3. Maps from app's richer `PictographData` to engine's minimal `PictographData` during indexing
4. Implements `getVariations(letter, position, gridMode)` with O(1) lookup
5. Implements `getAllVariations(gridMode)` returning all cached entries

- [ ] **Step 3: Register in DI container**

Add to the appropriate container file so it's available as a singleton.

- [ ] **Step 4: Build to verify types**

Run: `npm run check`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/pictograph/shared/services/implementations/BrowserVariationProvider.ts src/lib/shared/pictograph/shared/services/contracts/IBrowserVariationProvider.ts src/lib/shared/di/
git commit -m "feat: add BrowserVariationProvider implementing IVariationProvider for app"
```

---

## Task 11: Rewire `GenerationOrchestrator` to Shared Engine

Replace the internals of `GenerationOrchestrator` to delegate to `SequenceBuilder.build()`.

**Files:**
- Modify: `src/lib/features/create/generate/shared/services/implementations/GenerationOrchestrator.ts` (major rewrite)
- Create: `src/lib/features/create/generate/shared/services/implementations/BuildResultTransformer.ts` (converts `BuildResult` -> `SequenceData`)

- [ ] **Step 1: Create `BuildResultTransformer`**

Handles the mapping from engine's `BuildResult` + `SequenceStep[]` to the app's `SequenceData` + `StepData[]` + `StartPositionData`. This is the single point where engine types cross into app types.

```typescript
export class BuildResultTransformer implements IBuildResultTransformer {
  convertToSequenceData(
    result: BuildResult,
    options: GenerationOptions,
  ): SequenceData {
    // 1. Map SequenceStep[] -> StepData[]
    // 2. Extract StartPositionData from result.startPosition
    // 3. Create metadata via SequenceMetadataManager
    // 4. Create SequenceData
    // 5. Apply reversal detection
    // 6. Handle orientation cycle detection for circular
    return sequenceData;
  }
}
```

- [ ] **Step 2: Rewrite `GenerationOrchestrator` constructor**

Replace the 10 constructor dependencies with:
- `IBrowserVariationProvider` (for creating `SequenceBuilder`)
- `IBuildResultTransformer` (for output conversion)
- `ISequenceMetadataManager` (stays — app-specific metadata)
- `IStartPositionSelector` (stays — UI-specific position picking)

- [ ] **Step 3: Rewrite `generateFreeformSequence`**

```typescript
private async generateFreeformSequence(options: GenerationOptions): Promise<SequenceData> {
  const builder = new SequenceBuilder(this.variationProvider);
  const level = this.metadataService.mapDifficultyToLevel(options.difficulty);

  const result = builder.build({
    length: options.length,
    gridMode: options.gridMode,
    level,
    constraintOptions: this.mapPropContinuity(options.propContinuity),
    startPosition: options.startPosition?.startPosition,
    maxTurnIntensity: options.turnIntensity,
  });

  return this.converter.convertToSequenceData(result, options);
}

private mapPropContinuity(propContinuity?: PropContinuity): ConstraintOptions {
  switch (propContinuity) {
    case PropContinuity.CONTINUOUS:
      return { propContinuity: "maximize", handPathContinuity: "maximize" };
    case PropContinuity.RANDOM:
      return { propContinuity: "allow-reversals" };
    default:
      return { propContinuity: "maximize", handPathContinuity: "maximize" };
  }
}
```

- [ ] **Step 4: Rewrite `generateCircularSequence`**

```typescript
private async generateCircularSequence(options: GenerationOptions): Promise<SequenceData> {
  const builder = new SequenceBuilder(this.variationProvider);
  const level = this.metadataService.mapDifficultyToLevel(options.difficulty);

  const result = builder.build({
    length: options.length,
    gridMode: options.gridMode,
    level,
    constraintOptions: this.mapPropContinuity(options.propContinuity),
    startPosition: options.startPosition?.startPosition,
    maxTurnIntensity: options.turnIntensity,
    loop: {
      type: options.loopType ?? LOOPType.ROTATED,
      sliceSize: options.sliceSize ?? SliceSize.HALVED,
      useTargetedGeneration: true,
    },
  });

  return this.converter.convertToSequenceData(result, options);
}
```

- [ ] **Step 5: Update singleton wiring at bottom of file**

Replace the 10 imported singletons with the new smaller dependency set.

- [ ] **Step 6: Build to verify types**

Run: `npm run check`
Expected: No type errors

- [ ] **Step 7: Commit**

```bash
git add src/lib/features/create/generate/shared/services/implementations/GenerationOrchestrator.ts src/lib/features/create/generate/shared/services/implementations/BuildResultTransformer.ts
git commit -m "feat: rewire GenerationOrchestrator to delegate to shared SequenceBuilder"
```

---

## Task 12: Retire Dead Code

Remove app-side services that are now replaced by the shared engine.

**Files to delete:**
- `src/lib/features/create/generate/shared/services/implementations/StepGenerationOrchestrator.ts`
- `src/lib/features/create/generate/shared/services/implementations/PictographFilter.ts`
- `src/lib/features/create/generate/shared/services/implementations/TurnAllocator.ts`
- `src/lib/features/create/generate/shared/services/implementations/LOOPParameterProvider.ts`
- `src/lib/features/create/generate/circular/services/implementations/PartialSequenceGenerator.ts`
- `src/lib/features/create/generate/circular/services/implementations/LOOPEndPositionSelector.ts`
- `src/lib/features/create/generate/circular/services/implementations/LOOPExecutorSelector.ts`
- `src/lib/features/create/generate/circular/services/implementations/OrientationCycleDetector.ts`
- `src/lib/features/create/generate/circular/services/implementations/OrientationCycleExtender.ts`
- All 18 app-side LOOP executor files in `circular/services/implementations/`
- `src/lib/features/create/shared/services/implementations/sequence-transforms/orientation-propagation.ts` (if distinct from shared engine's)
- `src/lib/shared/pictograph/tka-glyph/services/implementations/LetterQueryHandler.ts` (absorbed by `BrowserVariationProvider`)

Also delete corresponding contract interfaces that are no longer used.

- [ ] **Step 1: Verify no remaining imports of retired files**

Search for imports of each retired file across the codebase. Fix any remaining references before deleting.

- [ ] **Step 2: Delete retired implementation files**

Remove all files listed above.

- [ ] **Step 3: Delete orphaned contract interfaces**

Remove `IStepGenerationOrchestrator.ts`, `ILOOPParameterProvider.ts`, `ITurnAllocator.ts`, `IPictographFilter.ts`, and any other contracts that no longer have consumers.

- [ ] **Step 4: Build to verify**

Run: `npm run check`
Expected: No type errors (all references cleaned up)

- [ ] **Step 5: Commit**

```bash
# Exception to "no git add -A" rule: this is a deletion-only commit.
# Stage all deletions explicitly via git add for each removed file.
git add <list all deleted files>
git commit -m "chore: retire app-side generation services replaced by shared engine"
```

---

## Deferred Work (Follow-up)

These items are intentionally deferred from this plan:

1. **NL parsing -> `ConstraintOptions`**: The spec envisions `parseConstraintSet()` resolving to `ConstraintOptions` first. Task 5 keeps the legacy NL parsing path for now. Follow-up: update `parseConstraintSet` to produce `ConstraintOptions` then call `buildConstraintSet`.
2. **`maximize-dash` soft preference**: Currently wired as hard exclude. Should use `DashPreferenceConstraint` as a soft scoring preference. Follow-up: add `preferMotionFamily` to `ConstraintOptions`.
3. **LOOP executor type migration**: Executors currently use `PictographData[]`. Follow-up: migrate to `SequenceStep[]` if the conversion overhead becomes measurable.
4. **Constraint preset UI in generate panel**: The app defaults to `smooth` behind the scenes. Exposing preset selection in the UI is a separate feature.
5. **`motionFamily.include` + `motionFamily.exclude` validation**: If both are provided with contradictory values, behavior is undefined. Follow-up: add validation or document precedence.

---

## Task 13: Integration Verification

End-to-end verification that MCP and app produce equivalent results.

- [ ] **Step 1: Run full engine test suite**

Run: `cd packages/sequence-engine && npx vitest run`
Expected: All pass

- [ ] **Step 2: Run app type check**

Run: `npm run check`
Expected: No errors

- [ ] **Step 3: Run app build**

Run: `npm run build`
Expected: Successful build

- [ ] **Step 4: MCP test — generate with smooth preset**

Use MCP tool: `generate_sequence(word: "BOOK", constraintPreset: "smooth")`
Expected: Valid sequence generated via shared engine

- [ ] **Step 5: MCP test — generate with isolation preset**

Use MCP tool: `generate_sequence(word: "AB", constraintPreset: "isolation")`
Expected: All motions are pro, all turns are 0, only shift motion families

- [ ] **Step 6: MCP test — compositional constraint**

Use MCP tool: `generate_sequence(word: "ABCD", constraintOptions: { motionType: "pro", rotationDirection: "ccw" })`
Expected: All pro motions, all counter-clockwise rotation

- [ ] **Step 7: App test — verify generate panel still works**

Ask user to test: open the app, go to Generate, click Generate with default settings. Verify a sequence appears in the workbench.

- [ ] **Step 8: Commit any fixes**

If verification revealed issues, fix them and commit.
