# Step Derived-Field Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a step's `gridMode`, `startPosition`, `endPosition`, and `letter` recompute from the motions at the write chokepoint so single-hand edits can never leave them stale and corrupt.

**Architecture:** Two layers. Layer 1 (sync) — a pure `reconcileStepDerived` / `normalizeSequenceDerived` pass that recomputes gridMode + positions from the two hand locations, called inside `setCurrentSequence` (the single sequence-write chokepoint) and inside the single-hand transform branches. Layer 2 (async) — letter recompute keyed on the *freshly derived* gridMode: fix `deriveSequenceLetters` to derive gridMode per-step, and wire the existing `recalculateLetterForBeat` into the turns edit seam. Mirrors the proven `recalculateAllOrientations` reconciliation pattern.

**Tech Stack:** TypeScript, Svelte 5 runes, Vitest 4, TDD. Reuses `deriveGridMode` (`grid-mode-deriver.ts:56`), `getGridPositionFromLocations` (`grid-position-deriver.ts:114`), `findLetterByMotionConfiguration` (`motion-query-handler.ts:326`), `recalculateLetterForBeat` (`rotation-direction-handler.ts:281`).

**Spec:** `docs/superpowers/specs/2026-05-29-step-derived-field-integrity-design.md`

---

## File Structure

**New:**
- `src/lib/shared/create/services/sequence-derived-fields.ts` — `reconcileStepDerived(step)`, `normalizeSequenceDerived(seq)`. Pure, sync, no side effects. Single responsibility: recompute the geometry-derived fields from motions.
- `src/lib/shared/create/services/sequence-derived-fields.test.ts`
- `src/lib/features/create/shared/state/core/sequence-core-state.derived.test.ts`
- `src/lib/shared/create/services/step-transforms.derived.test.ts`
- `src/lib/shared/create/services/sequence-transforms.gridmode.test.ts`
- `src/lib/features/create/shared/services/step-operator.turns-letter.test.ts`

**Modified:**
- `src/lib/features/create/shared/state/core/sequence-core-state.svelte.ts` — `setCurrentSequence` normalizes first, sets `state.gridMode` from the reconciled value.
- `src/lib/shared/create/services/step-transforms.ts` — single-hand branches of `mirrorBeat` / `flipBeat` / `rotateBeat` reconcile; fix the misleading comments.
- `src/lib/shared/create/services/sequence-transforms.ts` — `deriveSequenceLetters` derives gridMode per-step instead of trusting `sequence.gridMode`.
- `src/lib/features/create/shared/services/step-operator.ts` — `updateStepTurns` calls `recalculateLetterForBeat` after the turns edit (turns→float can change the letter).

---

## Background facts the implementer must know

1. **`createStepData` silently drops `gridMode`** (`createStepData.ts:9` never copies it). The reconciler therefore builds its result with a **plain object spread**, NOT `createStepData`, or the recomputed gridMode is lost.
2. **Every cardinal/intercardinal ordered pair is valid** in `POSITIONS_MAP` (8×8 = 64 entries: alpha/beta/gamma/zeta/eta). `getGridPositionFromLocations` only throws on a non-enum / corrupt location. The throw guard is defensive for in-flight/garbage data, not a normal path.
3. **`deriveGridMode` never throws** — it warns and defaults `DIAMOND` on an indeterminate pair. So gridMode reconciliation cannot "keep prior on throw"; positions are the guarded part.
4. **Per-motion gridMode is authoritative** (`MotionData.gridMode`, "CRITICAL: Grid mode for correct positioning"). Reconcile stamps gridMode onto both motions AND the step-level `gridMode`.
5. **`GridLocation` values:** `NORTH="n"`, `EAST="e"`, `SOUTH="s"`, `WEST="w"`, `NORTHEAST="ne"`, `SOUTHEAST="se"`, `SOUTHWEST="sw"`, `NORTHWEST="nw"`.
6. **Canonical repro geometry:** blue `nw→ne`, red `sw→se`. `getGridPositionFromLocations("nw","sw")` = `GAMMA14`; `("ne","se")` = `GAMMA4`; both hands intercardinal ⇒ gridMode `BOX`. Stale stored `alpha2`/`alpha4`/`M` are the corruption.

---

## Task 1: `reconcileStepDerived` — sync gridMode + position reconciliation

**Files:**
- Create: `src/lib/shared/create/services/sequence-derived-fields.ts`
- Test: `src/lib/shared/create/services/sequence-derived-fields.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/shared/create/services/sequence-derived-fields.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { reconcileStepDerived } from "./sequence-derived-fields";
import { createStepData } from "$lib/shared/create/factories/createStepData";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import {
  GridLocation,
  GridMode,
  GridPosition,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { StepData } from "$lib/shared/foundation/domain/models/StepData";

function step(
  blue: { start: GridLocation; end: GridLocation },
  red: { start: GridLocation; end: GridLocation },
  stale: Partial<StepData> = {}
): StepData {
  return {
    ...createStepData({
      ...stale,
      motions: {
        [MotionColor.BLUE]: createMotionData({
          color: MotionColor.BLUE,
          startLocation: blue.start,
          endLocation: blue.end,
        }),
        [MotionColor.RED]: createMotionData({
          color: MotionColor.RED,
          startLocation: red.start,
          endLocation: red.end,
        }),
      },
    }),
    // createStepData drops gridMode — re-apply any stale gridMode the test set
    ...(stale.gridMode !== undefined ? { gridMode: stale.gridMode } : {}),
  } as StepData;
}

describe("reconcileStepDerived", () => {
  it("heals the canonical stale alpha2 → GAMMA14 box-M step", () => {
    // blue nw→ne, red sw→se; stale stored alpha2/alpha4 from a pre-edit seed
    const stale = step(
      { start: GridLocation.NORTHWEST, end: GridLocation.NORTHEAST },
      { start: GridLocation.SOUTHWEST, end: GridLocation.SOUTHEAST },
      {
        startPosition: GridPosition.ALPHA2,
        endPosition: GridPosition.ALPHA4,
        letter: "M" as StepData["letter"],
      }
    );

    const fixed = reconcileStepDerived(stale);

    expect(fixed.startPosition).toBe(GridPosition.GAMMA14);
    expect(fixed.endPosition).toBe(GridPosition.GAMMA4);
    expect(fixed.gridMode).toBe(GridMode.BOX);
    // letter is Layer 2 (async) — reconcileStepDerived leaves it untouched here
    expect(fixed.letter).toBe("M");
  });

  it("derives DIAMOND + correct position for a cardinal pair", () => {
    const s = step(
      { start: GridLocation.SOUTH, end: GridLocation.NORTH },
      { start: GridLocation.NORTH, end: GridLocation.SOUTH }
    );
    const fixed = reconcileStepDerived(s);
    expect(fixed.gridMode).toBe(GridMode.DIAMOND);
    expect(fixed.startPosition).toBe(GridPosition.ALPHA1);
  });

  it("derives SKEWED + zeta position for a mixed cardinal/intercardinal pair", () => {
    const s = step(
      { start: GridLocation.SOUTHWEST, end: GridLocation.NORTH },
      { start: GridLocation.NORTH, end: GridLocation.SOUTHWEST }
    );
    const fixed = reconcileStepDerived(s);
    expect(fixed.gridMode).toBe(GridMode.SKEWED);
    expect(fixed.startPosition).toBe(GridPosition.ZETA1);
  });

  it("stamps the derived gridMode onto both motions", () => {
    const s = step(
      { start: GridLocation.NORTHWEST, end: GridLocation.NORTHEAST },
      { start: GridLocation.SOUTHWEST, end: GridLocation.SOUTHEAST }
    );
    const fixed = reconcileStepDerived(s);
    expect(fixed.motions[MotionColor.BLUE]?.gridMode).toBe(GridMode.BOX);
    expect(fixed.motions[MotionColor.RED]?.gridMode).toBe(GridMode.BOX);
  });

  it("preserves the step-level gridMode field (createStepData-drop trap)", () => {
    const s = step(
      { start: GridLocation.NORTHWEST, end: GridLocation.NORTHEAST },
      { start: GridLocation.SOUTHWEST, end: GridLocation.SOUTHEAST }
    );
    const fixed = reconcileStepDerived(s);
    expect(fixed.gridMode).toBeDefined();
    expect(fixed.gridMode).toBe(GridMode.BOX);
  });

  it("is idempotent on already-correct data", () => {
    const s = step(
      { start: GridLocation.SOUTH, end: GridLocation.NORTH },
      { start: GridLocation.NORTH, end: GridLocation.SOUTH }
    );
    const once = reconcileStepDerived(s);
    const twice = reconcileStepDerived(once);
    expect(twice.startPosition).toBe(once.startPosition);
    expect(twice.endPosition).toBe(once.endPosition);
    expect(twice.gridMode).toBe(once.gridMode);
  });

  it("keeps prior positions and does not throw on a corrupt location", () => {
    const s = step(
      { start: GridLocation.SOUTH, end: GridLocation.NORTH },
      { start: GridLocation.NORTH, end: GridLocation.SOUTH },
      { startPosition: GridPosition.ALPHA1 }
    );
    // Corrupt blue start location → not a valid pair key
    const corrupt: StepData = {
      ...s,
      motions: {
        ...s.motions,
        [MotionColor.BLUE]: {
          ...s.motions[MotionColor.BLUE]!,
          startLocation: "xyz" as GridLocation,
        },
      },
    };
    expect(() => reconcileStepDerived(corrupt)).not.toThrow();
    const fixed = reconcileStepDerived(corrupt);
    expect(fixed.startPosition).toBe(GridPosition.ALPHA1); // prior kept
  });

  it("returns blank/incomplete steps unchanged", () => {
    const blank = createStepData({ isBlank: true });
    expect(reconcileStepDerived(blank)).toBe(blank);
    const oneHand = createStepData({
      motions: { [MotionColor.BLUE]: createMotionData({}) },
    });
    expect(reconcileStepDerived(oneHand)).toBe(oneHand);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/shared/create/services/sequence-derived-fields.test.ts`
Expected: FAIL — `reconcileStepDerived` is not exported / module not found.

- [ ] **Step 3: Write the minimal implementation**

Create `src/lib/shared/create/services/sequence-derived-fields.ts`:

```ts
/**
 * Sequence Derived-Field Reconciliation
 *
 * gridMode, startPosition and endPosition are pure functions of the two hand
 * locations. They are also stored on steps/motions and historically mutated
 * independently of the motions, so single-hand edits leave them stale and
 * corrupt. These helpers recompute them from the motions so stored copies are
 * never trusted — only recomputed. Letter is async and handled separately
 * (deriveSequenceLetters / recalculateLetterForBeat).
 */
import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import { updateSequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { deriveGridMode } from "$lib/shared/pictograph/grid/services/grid-mode-deriver";
import { getGridPositionFromLocations } from "$lib/shared/pictograph/grid/services/grid-position-deriver";

/**
 * Recompute gridMode + start/end positions from a step's motions.
 *
 * - Plain object spread (NOT createStepData — that factory drops gridMode).
 * - Positions are guarded: getGridPositionFromLocations throws on a corrupt
 *   location pair, in which case the prior value is kept (an in-flight/invalid
 *   intermediate must not crash the editor).
 * - Blank / single-hand steps pass through unchanged.
 */
export function reconcileStepDerived<T extends StepData>(step: T): T {
  if (!step || step.isBlank) return step;

  const blue = step.motions?.[MotionColor.BLUE];
  const red = step.motions?.[MotionColor.RED];
  if (!blue || !red) return step;

  const gridMode: GridMode = deriveGridMode(blue, red);

  let startPosition = step.startPosition ?? null;
  let endPosition = step.endPosition ?? null;
  try {
    startPosition = getGridPositionFromLocations(
      blue.startLocation,
      red.startLocation
    );
  } catch {
    /* keep prior — corrupt/intermediate location pair */
  }
  try {
    endPosition = getGridPositionFromLocations(
      blue.endLocation,
      red.endLocation
    );
  } catch {
    /* keep prior */
  }

  return {
    ...step,
    gridMode,
    startPosition,
    endPosition,
    motions: {
      ...step.motions,
      [MotionColor.BLUE]: { ...blue, gridMode },
      [MotionColor.RED]: { ...red, gridMode },
    },
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/shared/create/services/sequence-derived-fields.test.ts`
Expected: PASS (all `reconcileStepDerived` tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/create/services/sequence-derived-fields.ts src/lib/shared/create/services/sequence-derived-fields.test.ts
git commit -m "feat(create): reconcileStepDerived — recompute gridMode+positions from motions" -- src/lib/shared/create/services/sequence-derived-fields.ts src/lib/shared/create/services/sequence-derived-fields.test.ts
```

---

## Task 2: `normalizeSequenceDerived` — sequence-wide reconciliation

**Files:**
- Modify: `src/lib/shared/create/services/sequence-derived-fields.ts`
- Test: `src/lib/shared/create/services/sequence-derived-fields.test.ts` (append)

- [ ] **Step 1: Write the failing test**

Append to `src/lib/shared/create/services/sequence-derived-fields.test.ts`:

```ts
import { normalizeSequenceDerived } from "./sequence-derived-fields";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

describe("normalizeSequenceDerived", () => {
  it("heals every step and sets sequence.gridMode from the reconciled steps", () => {
    const boxStep = step(
      { start: GridLocation.NORTHWEST, end: GridLocation.NORTHEAST },
      { start: GridLocation.SOUTHWEST, end: GridLocation.SOUTHEAST },
      { startPosition: GridPosition.ALPHA2, stepNumber: 1 }
    );
    const seq = {
      id: "s1",
      name: "t",
      word: "",
      steps: [boxStep],
      gridMode: GridMode.DIAMOND, // STALE sequence-level value
      difficulty: 1,
      metadata: {},
    } as unknown as SequenceData;

    const fixed = normalizeSequenceDerived(seq);

    expect(fixed.steps[0]!.startPosition).toBe(GridPosition.GAMMA14);
    expect(fixed.steps[0]!.gridMode).toBe(GridMode.BOX);
    expect(fixed.gridMode).toBe(GridMode.BOX); // sequence-level healed too
  });

  it("is a no-op (value-equal) on already-correct sequences", () => {
    const good = step(
      { start: GridLocation.SOUTH, end: GridLocation.NORTH },
      { start: GridLocation.NORTH, end: GridLocation.SOUTH },
      { stepNumber: 1 }
    );
    const seq = {
      id: "s2",
      name: "t",
      word: "",
      steps: [good],
      gridMode: GridMode.DIAMOND,
      difficulty: 1,
      metadata: {},
    } as unknown as SequenceData;

    const once = normalizeSequenceDerived(seq);
    const twice = normalizeSequenceDerived(once);
    expect(twice.steps[0]!.startPosition).toBe(once.steps[0]!.startPosition);
    expect(twice.gridMode).toBe(once.gridMode);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/shared/create/services/sequence-derived-fields.test.ts -t normalizeSequenceDerived`
Expected: FAIL — `normalizeSequenceDerived` is not exported.

- [ ] **Step 3: Write the minimal implementation**

Append to `src/lib/shared/create/services/sequence-derived-fields.ts`:

```ts
/**
 * Reconcile every step's derived fields and recompute the sequence-level
 * gridMode summary from the reconciled steps (a sequence's steps are normally
 * uniform; the per-step/per-motion gridMode is the authoritative copy).
 */
export function normalizeSequenceDerived(seq: SequenceData): SequenceData {
  const steps = seq.steps.map((s) => reconcileStepDerived(s));

  const firstReal = steps.find(
    (s) =>
      !s.isBlank &&
      s.motions?.[MotionColor.BLUE] &&
      s.motions?.[MotionColor.RED]
  );
  const gridMode = firstReal?.gridMode ?? seq.gridMode;

  return updateSequenceData(seq, { steps, gridMode });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/shared/create/services/sequence-derived-fields.test.ts`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/create/services/sequence-derived-fields.ts src/lib/shared/create/services/sequence-derived-fields.test.ts
git commit -m "feat(create): normalizeSequenceDerived — sequence-wide derived-field heal" -- src/lib/shared/create/services/sequence-derived-fields.ts src/lib/shared/create/services/sequence-derived-fields.test.ts
```

---

## Task 3: Reconcile at the `setCurrentSequence` chokepoint

**Files:**
- Modify: `src/lib/features/create/shared/state/core/sequence-core-state.svelte.ts:84-91`
- Test: `src/lib/features/create/shared/state/core/sequence-core-state.derived.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/features/create/shared/state/core/sequence-core-state.derived.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createSequenceCoreState } from "./sequence-core-state.svelte";
import { createStepData } from "$lib/shared/create/factories/createStepData";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import {
  GridLocation,
  GridMode,
  GridPosition,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

describe("setCurrentSequence reconciles derived fields", () => {
  it("heals a stale alpha2/box step and derives state.gridMode (not trusts stored)", () => {
    const core = createSequenceCoreState();

    const staleStep = createStepData({
      stepNumber: 1,
      startPosition: GridPosition.ALPHA2, // STALE
      endPosition: GridPosition.ALPHA4, // STALE
      motions: {
        [MotionColor.BLUE]: createMotionData({
          color: MotionColor.BLUE,
          startLocation: GridLocation.NORTHWEST,
          endLocation: GridLocation.NORTHEAST,
        }),
        [MotionColor.RED]: createMotionData({
          color: MotionColor.RED,
          startLocation: GridLocation.SOUTHWEST,
          endLocation: GridLocation.SOUTHEAST,
        }),
      },
    });

    const seq = {
      id: "s1",
      name: "t",
      word: "",
      steps: [staleStep],
      gridMode: GridMode.DIAMOND, // STALE — must NOT be trusted
      difficulty: 1,
      metadata: {},
    } as unknown as SequenceData;

    core.setCurrentSequence(seq);

    expect(core.currentSequence?.steps[0]?.startPosition).toBe(
      GridPosition.GAMMA14
    );
    expect(core.currentSequence?.steps[0]?.endPosition).toBe(
      GridPosition.GAMMA4
    );
    expect(core.gridMode).toBe(GridMode.BOX);
  });

  it("setting null clears state without throwing", () => {
    const core = createSequenceCoreState();
    core.setCurrentSequence(null);
    expect(core.currentSequence).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/features/create/shared/state/core/sequence-core-state.derived.test.ts`
Expected: FAIL — `startPosition` is still `ALPHA2` and `gridMode` is `DIAMOND` (stored values trusted).

- [ ] **Step 3: Implement — normalize first, derive gridMode from the reconciled sequence**

In `src/lib/features/create/shared/state/core/sequence-core-state.svelte.ts`, add the import near the top (after the existing imports, ~line 14):

```ts
import { normalizeSequenceDerived } from "$lib/shared/create/services/sequence-derived-fields";
```

Replace the `setCurrentSequence` method (lines 84-91):

```ts
    // Setters
    setCurrentSequence(sequence: SequenceData | null) {
      // Derived fields (gridMode, start/end positions) are recomputed from the
      // motions here so stale stored copies from single-hand edits self-heal.
      const reconciled = sequence
        ? normalizeSequenceDerived(sequence)
        : sequence;
      state.currentSequence = reconciled;
      state.selectedSequenceId = reconciled?.id ?? null;
      // Derive gridMode from the reconciled sequence — never trust the stored value.
      if (reconciled?.gridMode !== undefined) {
        state.gridMode = reconciled.gridMode;
      }
    },
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/features/create/shared/state/core/sequence-core-state.derived.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/create/shared/state/core/sequence-core-state.svelte.ts src/lib/features/create/shared/state/core/sequence-core-state.derived.test.ts
git commit -m "fix(create): reconcile derived fields at setCurrentSequence chokepoint" -- src/lib/features/create/shared/state/core/sequence-core-state.svelte.ts src/lib/features/create/shared/state/core/sequence-core-state.derived.test.ts
```

---

## Task 4: Reconcile inside single-hand transform branches

**Files:**
- Modify: `src/lib/shared/create/services/step-transforms.ts` (single-hand branches of `mirrorBeat`, `flipBeat`, `rotateBeat`)
- Test: `src/lib/shared/create/services/step-transforms.derived.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/shared/create/services/step-transforms.derived.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { rotateBeat } from "./step-transforms";
import { createStepData } from "$lib/shared/create/factories/createStepData";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import {
  MotionColor,
  MotionType,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import {
  GridLocation,
  GridMode,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { getGridPositionFromLocations } from "$lib/shared/pictograph/grid/services/grid-position-deriver";
import type { IMotionQueryHandler } from "$lib/shared/foundation/services/data/data-contracts";

const queryStub = {
  findLetterByMotionConfiguration: async () => null,
} as unknown as IMotionQueryHandler;

describe("single-hand rotateBeat reconciles positions", () => {
  it("recomputes startPosition from the rotated blue location (no longer stale)", async () => {
    const s = createStepData({
      stepNumber: 1,
      motions: {
        [MotionColor.BLUE]: createMotionData({
          color: MotionColor.BLUE,
          motionType: MotionType.PRO,
          rotationDirection: RotationDirection.CLOCKWISE,
          startLocation: GridLocation.NORTH,
          endLocation: GridLocation.EAST,
        }),
        [MotionColor.RED]: createMotionData({
          color: MotionColor.RED,
          motionType: MotionType.PRO,
          rotationDirection: RotationDirection.CLOCKWISE,
          startLocation: GridLocation.SOUTH,
          endLocation: GridLocation.WEST,
        }),
      },
    });

    // Rotate ONLY blue by 1 step (45° CW) — positions must reflect the new pair.
    const out = await rotateBeat(s, 1, GridMode.DIAMOND, queryStub, "blue");

    const blue = out.motions[MotionColor.BLUE]!;
    const red = out.motions[MotionColor.RED]!;
    expect(out.startPosition).toBe(
      getGridPositionFromLocations(blue.startLocation, red.startLocation)
    );
    expect(out.endPosition).toBe(
      getGridPositionFromLocations(blue.endLocation, red.endLocation)
    );
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/shared/create/services/step-transforms.derived.test.ts`
Expected: FAIL — single-hand branch keeps the original `startPosition`, which no longer matches the rotated pair.

- [ ] **Step 3: Implement — reconcile the single-hand branches**

In `src/lib/shared/create/services/step-transforms.ts`, add the import (after line 23, the existing grid-position-deriver import):

```ts
import { reconcileStepDerived } from "$lib/shared/create/services/sequence-derived-fields";
```

Replace the single-hand return in `mirrorBeat` (lines 94-100):

```ts
  // Single-hand: positions depend on BOTH locations, so recompute them from the
  // mutated motions. Letter is reconciled asynchronously by the caller.
  return reconcileStepDerived(
    createStepData({
      ...step,
      motions: mirroredMotions,
    })
  );
```

Replace the single-hand return in `flipBeat` (lines 139-144):

```ts
  // Single-hand: recompute positions from the mutated motions (letter is async).
  return reconcileStepDerived(
    createStepData({
      ...step,
      motions: flippedMotions,
    })
  );
```

Replace the single-hand return in `rotateBeat` (lines 204-209):

```ts
  // Single-hand: recompute positions from the rotated motions (letter is async).
  return reconcileStepDerived(
    createStepData({
      ...step,
      motions: rotatedMotions,
    })
  );
```

Also update the file's top-of-file doc comment (lines 12-14) so it no longer claims positions stay valid when one hand changes:

```ts
 * For single-hand transforms, positions are recomputed from both hands via
 * reconcileStepDerived (a position is a function of BOTH locations). Letters are
 * reconciled asynchronously by the calling sequence-transform operation.
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/shared/create/services/step-transforms.derived.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the existing transform tests for regressions**

Run: `npx vitest run src/lib/shared/create/services/`
Expected: PASS (no regressions in existing transform/sequence tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/create/services/step-transforms.ts src/lib/shared/create/services/step-transforms.derived.test.ts
git commit -m "fix(create): recompute positions in single-hand mirror/flip/rotate" -- src/lib/shared/create/services/step-transforms.ts src/lib/shared/create/services/step-transforms.derived.test.ts
```

---

## Task 5: `deriveSequenceLetters` — derive gridMode per-step

**Files:**
- Modify: `src/lib/shared/create/services/sequence-transforms.ts:436-478`
- Test: `src/lib/shared/create/services/sequence-transforms.gridmode.test.ts`

**Why:** `deriveSequenceLetters` currently keys the letter lookup on `sequence.gridMode ?? DIAMOND` for *every* step (line 440). When the sequence-level gridMode is stale (e.g. a box step inside a diamond-labelled sequence), the letter is looked up under the wrong grid mode. Derive gridMode per-step from the motions instead.

- [ ] **Step 1: Write the failing test**

Create `src/lib/shared/create/services/sequence-transforms.gridmode.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { deriveSequenceLetters } from "./sequence-transforms";
import { createStepData } from "$lib/shared/create/factories/createStepData";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import {
  GridLocation,
  GridMode,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { IMotionQueryHandler } from "$lib/shared/foundation/services/data/data-contracts";

describe("deriveSequenceLetters derives gridMode per-step", () => {
  it("looks up the letter under BOX for an intercardinal step even when sequence.gridMode is stale DIAMOND", async () => {
    const boxStep = createStepData({
      stepNumber: 1,
      motions: {
        [MotionColor.BLUE]: createMotionData({
          color: MotionColor.BLUE,
          startLocation: GridLocation.NORTHWEST,
          endLocation: GridLocation.NORTHEAST,
        }),
        [MotionColor.RED]: createMotionData({
          color: MotionColor.RED,
          startLocation: GridLocation.SOUTHWEST,
          endLocation: GridLocation.SOUTHEAST,
        }),
      },
    });

    const seq = {
      id: "s1",
      name: "t",
      word: "",
      steps: [boxStep],
      gridMode: GridMode.DIAMOND, // STALE
      difficulty: 1,
      metadata: {},
    } as unknown as SequenceData;

    const spy = vi.fn().mockResolvedValue("M");
    const handler = {
      findLetterByMotionConfiguration: spy,
    } as unknown as IMotionQueryHandler;

    await deriveSequenceLetters(seq, handler);

    expect(spy).toHaveBeenCalledTimes(1);
    const [, , gridModeArg] = spy.mock.calls[0]!;
    expect(gridModeArg).toBe(GridMode.BOX); // per-step, NOT the stale DIAMOND
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/shared/create/services/sequence-transforms.gridmode.test.ts`
Expected: FAIL — `gridModeArg` is `DIAMOND` (the stale sequence-level value).

- [ ] **Step 3: Implement — derive gridMode per-step**

In `src/lib/shared/create/services/sequence-transforms.ts`, ensure `deriveGridMode` is imported (add if absent, alongside the existing grid imports):

```ts
import { deriveGridMode } from "$lib/shared/pictograph/grid/services/grid-mode-deriver";
```

Replace the body of `deriveSequenceLetters` (lines 436-478). Remove the sequence-level `const gridMode = sequence.gridMode ?? GridMode.DIAMOND;` and derive per-step:

```ts
export async function deriveSequenceLetters(
  sequence: SequenceData,
  motionQueryHandler: IMotionQueryHandler
): Promise<SequenceData> {
  // Derive letters for all steps in parallel
  const stepsWithLetters = await Promise.all(
    sequence.steps.map(async (step) => {
      if (step.isBlank) return step;

      const blueMotion = step.motions[MotionColor.BLUE];
      const redMotion = step.motions[MotionColor.RED];

      if (!blueMotion || !redMotion) return step;

      // Derive gridMode per-step from the motions — never trust the stale
      // sequence-level value (a box step inside a diamond-labelled sequence
      // would otherwise be looked up under the wrong grid mode).
      const gridMode = deriveGridMode(blueMotion, redMotion);

      try {
        const foundLetter =
          await motionQueryHandler.findLetterByMotionConfiguration(
            blueMotion,
            redMotion,
            gridMode
          );
        if (foundLetter) {
          return createStepData({
            ...step,
            letter: foundLetter as Letter,
          });
        }
      } catch (error) {
        console.warn(
          `Failed to derive letter for step ${step.stepNumber}:`,
          error
        );
      }
      return step;
    })
  );

  return updateSequenceData(sequence, {
    steps: stepsWithLetters,
  });
}
```

(If, after removing the sequence-level usage, the `GridMode` import becomes unused in this file, remove it to keep the build clean. Leave it if other functions in the file still reference it.)

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/shared/create/services/sequence-transforms.gridmode.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/create/services/sequence-transforms.ts src/lib/shared/create/services/sequence-transforms.gridmode.test.ts
git commit -m "fix(create): deriveSequenceLetters keys letter lookup on per-step gridMode" -- src/lib/shared/create/services/sequence-transforms.ts src/lib/shared/create/services/sequence-transforms.gridmode.test.ts
```

---

## Task 6: Wire letter reconcile into the turns edit seam

**Files:**
- Modify: `src/lib/features/create/shared/services/step-operator.ts:67-75`
- Test: `src/lib/features/create/shared/services/step-operator.turns-letter.test.ts`

**Why:** A turns edit can convert a motion to/from FLOAT, which changes the pictograph's letter (float-variant letters differ). `updateStepTurns` recomputes orientation but never the letter. Reuse the existing, proven `recalculateLetterForBeat` (it already derives gridMode fresh and applies the new letter) — the same helper the rotation-direction edit already uses. `StepOperator` already holds `this.motionQueryHandler`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/features/create/shared/services/step-operator.turns-letter.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { StepOperator } from "./step-operator";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import {
  MotionColor,
  MotionType,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
import type { ICreateModuleState } from "../types/create-module-types";
import type { IMotionQueryHandler } from "$lib/shared/foundation/services/data/data-contracts";

// Keep orientation + reversal + propagation inert so the test exercises only
// the turns edit + the new letter-reconcile wiring.
vi.mock("$lib/shared/pictograph/prop/services/orientation-calculator", () => ({
  calculateEndOrientation: () => "in",
}));
vi.mock("$lib/shared/create/services/reversal-detector", () => ({
  reversalDetector: { processReversals: (seq: unknown) => seq },
}));
vi.mock(
  "$lib/features/create/shared/services/step-operations/orientation-handler",
  () => ({
    calculatePropagatedSteps: (
      _stepNum: number,
      _color: string,
      seq: { steps: StepData[] }
    ) => seq.steps,
    calculateEndOrientation: () => "in",
  })
);

function makeStep(stepNumber: number): StepData {
  return {
    id: `step-${stepNumber}`,
    stepNumber,
    duration: 1,
    blueReversal: false,
    redReversal: false,
    isBlank: false,
    motions: {
      [MotionColor.BLUE]: createMotionData({
        color: MotionColor.BLUE,
        motionType: MotionType.PRO,
        rotationDirection: RotationDirection.CLOCKWISE,
        startLocation: GridLocation.NORTH,
        endLocation: GridLocation.EAST,
        turns: 0,
      }),
      [MotionColor.RED]: createMotionData({
        color: MotionColor.RED,
        motionType: MotionType.PRO,
        rotationDirection: RotationDirection.CLOCKWISE,
        startLocation: GridLocation.SOUTH,
        endLocation: GridLocation.WEST,
        turns: 0,
      }),
    },
  } as StepData;
}

function makeMockState(steps: StepData[]): ICreateModuleState {
  let current = {
    id: "test",
    name: "test",
    word: "",
    steps,
    gridMode: "diamond",
    difficulty: 1,
    metadata: {},
  };
  return {
    sequenceState: {
      get currentSequence() {
        return current;
      },
      selectedStartPosition: null,
      setCurrentSequence: (seq: unknown) => {
        current = seq as typeof current;
      },
      setStartPosition: () => {},
      updateStep: () => {},
    },
    pushUndoSnapshot: () => {},
  } as unknown as ICreateModuleState;
}

describe("StepOperator.updateStepTurns reconciles the letter", () => {
  it("invokes the motion query handler to re-derive the letter after a turns edit", async () => {
    const spy = vi.fn().mockResolvedValue("A");
    const handler = {
      findLetterByMotionConfiguration: spy,
    } as unknown as IMotionQueryHandler;

    const op = new StepOperator(handler);
    const state = makeMockState([makeStep(1), makeStep(2)]);

    op.updateStepTurns(2, MotionColor.BLUE, 0.5, state, null);

    // recalculateLetterForBeat runs synchronously up to its first await, so the
    // handler is already invoked; flush a microtask to be safe.
    await Promise.resolve();
    expect(spy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/features/create/shared/services/step-operator.turns-letter.test.ts`
Expected: FAIL — the query handler is never called (no letter reconcile wired into the turns path).

- [ ] **Step 3: Implement — call `recalculateLetterForBeat` after the turns edit**

In `src/lib/features/create/shared/services/step-operator.ts`, add the import (alongside the existing `updateStepTurns` import from `./step-operations/turns-handler`):

```ts
import { recalculateLetterForBeat } from "./step-operations/rotation-direction-handler";
```

Replace the `updateStepTurns` method (lines 67-75):

```ts
  updateStepTurns(
    stepNumber: number,
    color: string,
    turnAmount: number | "fl",
    createModuleState: ICreateModuleState,
    _panelState: unknown
  ): void {
    updateStepTurns(stepNumber, color, turnAmount, createModuleState);
    // A turns edit can convert to/from FLOAT, which changes the letter.
    // Reuse the proven async letter reconcile (derives gridMode fresh).
    void recalculateLetterForBeat(
      stepNumber,
      createModuleState,
      this.motionQueryHandler
    );
  }
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/features/create/shared/services/step-operator.turns-letter.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/create/shared/services/step-operator.ts src/lib/features/create/shared/services/step-operator.turns-letter.test.ts
git commit -m "fix(create): reconcile letter after a turns edit (float conversion)" -- src/lib/features/create/shared/services/step-operator.ts src/lib/features/create/shared/services/step-operator.turns-letter.test.ts
```

---

## Task 7: Full-suite gate + browser verification of the box-M card

**Files:** none (verification only)

- [ ] **Step 1: Run the full type/lint/test gate once**

Run: `npm run check > /tmp/check.log 2>&1; npx vitest run src/lib/shared/create src/lib/features/create/shared/state/core src/lib/features/create/shared/services`
Then filter: `grep -niE "error|fail" /tmp/check.log`
Expected: no new errors introduced by the modified files; all new + existing tests pass.

- [ ] **Step 2: Browser verification of the box-M elemental glyph**

With the dev server on `:5173`, load the card/sequence that previously rendered Austen's box-M mislabelled as **air** (together-opp). After the fix the step carries its real letter + gamma position, so the existing `tnd-calculator` lookup receives correct inputs.

- Capture the rendered elemental glyph / label for the box-M step.
- Expected: the glyph reads **fire** (split-opp), not air — matching the invariant that a split-opp family stays split-opp in box mode.
- Per `verification-protocol.md`: include the screenshot or the runtime-queried label in the report. If the browser cannot be driven, state explicitly: *"I cannot verify this visually — please open [route] and tell me whether the box-M step's element reads fire (split-opp) or air."*

- [ ] **Step 3: Report**

Summarize: tests green (paste counts), check clean, and the box-M label before/after. Do not claim the visual fix without the captured label or an explicit can't-verify statement.

---

## Self-Review

**Spec coverage:**
- Layer 1 sync gridMode+position reconcile → Tasks 1, 3, 4. ✅
- `setCurrentSequence` derives gridMode (not trusts stored) → Task 3. ✅
- Single-hand transform branches reconcile → Task 4. ✅
- Layer 2 async letter, keyed on fresh gridMode → Task 5 (batch transforms) + Task 6 (turns). ✅
- Orientation must NOT reconcile letter (regression guard) → not wired into orientation-handler; the negative case is covered because reconcileStepDerived depends only on locations (an orientation edit changes neither locations nor the letter path). ✅
- Non-goal: tnd-calculator NOT rewritten; on-read getters NOT introduced. ✅
- Browser re-verify of box-M → Task 7. ✅

**Note on the spec's `reconcileStepLetter`:** realized by reusing the existing `recalculateLetterForBeat` (imperative edits) and fixing `deriveSequenceLetters` (batch), rather than adding a new helper — satisfies never-hand-roll. Documented in Tasks 5-6.

**Placeholder scan:** none — every step has concrete code + exact run command.

**Type consistency:** `reconcileStepDerived<T extends StepData>` and `normalizeSequenceDerived(seq): SequenceData` used identically across Tasks 1-4. `recalculateLetterForBeat(stepNumber, createModuleState, motionQueryHandler)` signature matches `rotation-direction-handler.ts:281`. `deriveSequenceLetters(sequence, motionQueryHandler)` matches `sequence-transforms.ts:436`.

---

## Relationship to box mode (#33)

With derived fields trustworthy, box-mode cards render the correct elemental glyph and the box-mode descriptor axis (sync geometric rotation, per-family direction, Diamond|Box|Both) resumes from its settled design. This plan is the prerequisite; box mode follows.
