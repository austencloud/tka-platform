# Generative Turn Configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user specify a turn pattern, and therefore a layer pattern, before generating a sequence rather than only after.

**Architecture:** A turn pattern enters `BuildOptions` and is consulted by the beam search through a new `TurnSource` seam, so the search never picks a static letter at an index the pattern zeroes. Because a pattern is a period indexed modulo its length, it resolves at every step index including bridge steps, which the current length-bound random allocation cannot do. The Generate panel's `TurnIntensityCard` becomes a two-mode `TurnsCard` reusing the existing `PatternStripEditor`, with a derived layer readout, and the start-orientation control that sets the readout's starting layer moves into the Start Position drill as a `SegmentedControl`.

**Tech Stack:** TypeScript, Svelte 5 runes, Vitest, the `@tka/sequence-engine` workspace package.

Spec: `docs/superpowers/specs/2026-08-16-generative-turn-configuration-design.md`

---

## File Structure

**Engine (`packages/sequence-engine/`)**

| File | Responsibility |
| --- | --- |
| `src/generation/turns/TurnSource.ts` (create) | The seam: how any consumer asks for the turn at a step index. Two implementations, random-array and pattern-period. |
| `src/generation/turns/TurnSource.test.ts` (create) | Unit tests for both implementations, especially past-the-end indexing. |
| `src/generation/builder/SequenceBuilder.ts` (modify) | `BuildOptions.turnPattern`, construct the source, pass it down. |
| `src/generation/builder/BeamSearch.ts` (modify) | Consume `TurnSource` instead of raw `TurnAllocation` arrays. |
| `src/generation/index.ts` (modify) | Export the new types. |
| `tests/generation/turn-pattern-build.test.ts` (create) | The proof: a bridged word gets turns at every step. |
| `tests/generation/turn-pattern-claims.test.ts` (create) | The readout matches the build; a zeroed step gets no static letter. |

**Shared layer prediction (`src/lib/shared/create/domain/`)**

| File | Responsibility |
| --- | --- |
| `layer-prediction.ts` (create) | Pure: start orientations plus a turn strip give the layer signature, before any sequence exists. |
| `__tests__/layer-prediction.test.ts` (create) | Unit tests including the float-uncertainty case. |
| `turn-pattern-data.ts` (modify) | Add `clampLanesToLevel`, which brings a drawn strip into a level's legal values. |
| `__tests__/turn-pattern-level.test.ts` (create) | Level-drop rounding, including float to zero. |
| `__tests__/loop-period-strip.test.ts` (create) | LOOP periods admit only divisors. |

**Generate panel (`src/lib/features/create/generate/components/cards/`)**

| File | Responsibility |
| --- | --- |
| `TurnsCard.svelte` (create) | Two-mode card. Owns mode state, delegates to StepperCard or PatternStripEditor. |
| `LayerReadout.svelte` (create) | Presentational. Renders a predicted signature. |
| `TurnIntensityCard.svelte` (delete) | Subsumed by TurnsCard. |
| `CustomizeExpandedOverlay.svelte` (modify) | Drop the `startOri` drill row; render orientation inside `startPos`. |

**Shared control (`src/lib/features/create/shared/components/sequence-actions/`)**

| File | Responsibility |
| --- | --- |
| `PropOrientationControl.svelte` (modify) | Stepper becomes `SegmentedControl`. |
| `PropOrientationControl.svelte.test.ts` (modify) | Update to the new role semantics. |

---

## Phase A — Engine

### Task 1: The TurnSource seam

**Files:**
- Create: `packages/sequence-engine/src/generation/turns/TurnSource.ts`
- Test: `packages/sequence-engine/src/generation/turns/TurnSource.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { allocationSource, patternSource } from "./TurnSource.js";

describe("TurnSource", () => {
  it("reports no turn past the end of a random allocation", () => {
    // Today's behaviour, preserved: eager allocation is length-bound, so a
    // sequence longer than its allocation has steps with no turn at all.
    const source = allocationSource({ blue: [1, 2], red: [0, 0.5] });
    expect(source.at(0, "blue")).toBe(1);
    expect(source.at(2, "blue")).toBeUndefined();
  });

  it("resolves at every index, however far out, when driven by a pattern", () => {
    // A period has no length. This is what lets a pattern cover bridge steps.
    const source = patternSource({ blue: [0, 1.5], red: [0.5] });
    expect(source.at(0, "blue")).toBe(0);
    expect(source.at(1, "blue")).toBe(1.5);
    expect(source.at(2, "blue")).toBe(0);
    expect(source.at(97, "blue")).toBe(1.5);
    expect(source.at(97, "red")).toBe(0.5);
  });

  it("treats an empty lane as no turn rather than dividing by zero", () => {
    const source = patternSource({ blue: [], red: [] });
    expect(source.at(0, "blue")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/sequence-engine/src/generation/turns/TurnSource.test.ts`
Expected: FAIL, "Failed to resolve import ./TurnSource.js"

- [ ] **Step 3: Write minimal implementation**

```ts
/**
 * How anything that builds a sequence asks "what turn does this step get?".
 *
 * Two kinds answer that question and they differ in one way that matters. A
 * random allocation is a fixed-length array decided up front, so once the
 * search inserts bridge steps and runs past that length it has nothing left to
 * give. A pattern is a period: it is indexed modulo its own length, so it
 * answers at every index that will ever exist, bridges included.
 */

import type { TurnAllocation } from "./TurnAllocator.js";

/**
 * Derived from the allocator rather than declared again. There are already
 * four separate `TurnValue` declarations in this repo and a fifth would be one
 * more thing to keep in step.
 */
export type TurnValue = TurnAllocation["blue"][number];
export type TurnColor = "blue" | "red";

export interface TurnLanes {
  readonly blue: readonly TurnValue[];
  readonly red: readonly TurnValue[];
}

export interface TurnSource {
  at(stepIndex: number, color: TurnColor): TurnValue | undefined;
}

/** Fixed-length allocation. Runs out past its end, which is today's behaviour. */
export function allocationSource(lanes: TurnLanes): TurnSource {
  return {
    at(stepIndex, color) {
      const lane = lanes[color];
      if (stepIndex < 0 || stepIndex >= lane.length) return undefined;
      return lane[stepIndex];
    },
  };
}

/** Repeating period. Never runs out. */
export function patternSource(lanes: TurnLanes): TurnSource {
  return {
    at(stepIndex, color) {
      const lane = lanes[color];
      if (lane.length === 0 || stepIndex < 0) return undefined;
      return lane[stepIndex % lane.length];
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/sequence-engine/src/generation/turns/TurnSource.test.ts`
Expected: PASS, 3 tests

- [ ] **Step 5: Commit**

```bash
git add packages/sequence-engine/src/generation/turns/TurnSource.ts packages/sequence-engine/src/generation/turns/TurnSource.test.ts
git commit -m "feat(engine): a turn source that a period can answer at any index" -- packages/sequence-engine/src/generation/turns/TurnSource.ts packages/sequence-engine/src/generation/turns/TurnSource.test.ts
```

---

### Task 2: Consume the source in the beam search

`enrichWithTurns` currently reads `turnAllocation.blue[stepIndex]` directly at `BeamSearch.ts:65`. Route it through the source so the search sees pattern turns while choosing letters. This is what makes `Type6Constraint` reject a static letter where the pattern says zero.

**Files:**
- Modify: `packages/sequence-engine/src/generation/builder/BeamSearch.ts:56-82`

- [ ] **Step 1: Change the signature and body of `enrichWithTurns`**

Replace the parameter and the two lookups. The rest of the function is unchanged.

```ts
function enrichWithTurns(
  variation: PictographData,
  stepIndex: number,
  turnSource: TurnSource | undefined,
  previousSteps: PictographData[],
  propContinuity: PropContinuityMode | undefined
): PictographData {
  if (!turnSource) return variation;

  const blueTurns = turnSource.at(stepIndex, "blue");
  const redTurns = turnSource.at(stepIndex, "red");
```

- [ ] **Step 2: Add the import**

At the top of `BeamSearch.ts`, alongside the existing `TurnAllocation` import:

```ts
import type { TurnSource } from "../turns/TurnSource.js";
```

- [ ] **Step 3: Rename the threaded parameter**

`turnAllocation` is threaded through `BeamSearch` at lines 206, 271, 356, 434, 556, and 653. Change each declaration from `turnAllocation?: TurnAllocation` to `turnSource?: TurnSource`, and each pass-through from `turnAllocation,` to `turnSource,`. The `TurnAllocation` import may become unused; remove it if so.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --build packages/tsconfig.build.json`
Expected: errors only in `SequenceBuilder.ts`, which still passes a `TurnAllocation`. Task 3 fixes those.

---

### Task 3: Build the source in SequenceBuilder and accept a pattern

**Files:**
- Modify: `packages/sequence-engine/src/generation/builder/SequenceBuilder.ts` (BuildOptions at 186, word path at 578, length path at 783, materialization at 1288)

- [ ] **Step 1: Add the option to `BuildOptions`**

Insert after `maxTurnIntensity` (line 218):

```ts
  /**
   * Turns to use instead of rolling them at random, given as a repeating
   * period per prop. `{ blue: [0, 1.5], red: [0.5] }` means blue alternates no
   * turn and a turn and a half while red takes a half turn every step.
   *
   * The period is indexed modulo its own length, so it covers every step the
   * search produces, including the bridge steps inserted between letters that
   * have no direct transition. It is also visible to the constraint system
   * while letters are being chosen, which is why a zeroed step will not be
   * given a static letter that needs turns to be worth anything.
   */
  turnPattern?: TurnLanes;
```

Add to the imports at the top of the file:

```ts
import {
  allocationSource,
  patternSource,
  type TurnLanes,
  type TurnSource,
} from "../turns/TurnSource.js";
```

- [ ] **Step 2: Build the source on the word path**

At line 577, replace the turn allocation stage:

```ts
    // Stage 3: Allocate turns
    const turnSource: TurnSource = options.turnPattern
      ? patternSource(options.turnPattern)
      : allocationSource(
          allocateTurns(
            letters.length,
            options.level,
            options.maxTurnIntensity,
            resolveTurnAllocationOptions(options)
          )
        );
```

Then change every downstream `turnAllocation,` pass in this method to `turnSource,`.

- [ ] **Step 3: Do the same on the length path**

At line 782, identically, using `length` instead of `letters.length`.

- [ ] **Step 4: Fix materialization**

At line 1287, the guard that produces the bridge bug is replaced by the source, which owns the bounds question now:

```ts
      const blueTurn = turnSource.at(stepTurnIndex, "blue");
      const redTurn = turnSource.at(stepTurnIndex, "red");
```

Change the enclosing method's parameter at line 1257 from `turnAllocation: TurnAllocation` to `turnSource: TurnSource`.

- [ ] **Step 5: Keep the reported allocation**

`BuildResult` exposes `turnAllocation` (declared line 321) and consumers read it. Build it from the source at the sequence's real length so it now reports what was actually used, bridges included:

```ts
    const turnAllocation: TurnAllocation = {
      blue: steps.map((_, i) => turnSource.at(i, "blue") ?? 0),
      red: steps.map((_, i) => turnSource.at(i, "red") ?? 0),
    };
```

Place this after the steps are final, before the result object is assembled.

- [ ] **Step 6: Export the new types**

In `packages/sequence-engine/src/generation/index.ts`, beside the existing TurnAllocator exports:

```ts
export {
  allocationSource,
  patternSource,
  type TurnLanes,
  type TurnSource,
} from "./turns/TurnSource.js";
```

- [ ] **Step 7: Typecheck and run the engine suite**

Run: `npx tsc --build packages/tsconfig.build.json && npx vitest run packages/sequence-engine`
Expected: PASS. `loop-spec-build.test.ts` has known randomized flake unrelated to this change; rerun once to confirm any failure there is not new.

- [ ] **Step 8: Commit**

```bash
git commit -m "feat(engine): generate from a turn pattern, not just a turn cap" -- packages/sequence-engine/src/generation/builder/SequenceBuilder.ts packages/sequence-engine/src/generation/builder/BeamSearch.ts packages/sequence-engine/src/generation/index.ts
```

---

### Task 4: Prove the bridge case

This is the load-bearing test. `WXYZWXYZWXYZWXYZ` is 16 letters and builds to roughly 31 steps, of which the last 15 currently receive no turns at all.

**Files:**
- Create: `packages/sequence-engine/tests/generation/turn-pattern-build.test.ts`

- [ ] **Step 1: Write the failing test**

Copy the `beforeAll` graph setup, `CsvVariationProvider`, `loadVariations`, and `builder()` helpers verbatim from `packages/sequence-engine/tests/generation/layer-pattern-build.test.ts` lines 29 to 109, then:

```ts
describe("SequenceBuilder — turnPattern", () => {
  it("gives every step a turn, including the bridges a word needs", () => {
    const result = builder().build({
      word: "WXYZWXYZWXYZWXYZ",
      gridMode: "diamond",
      level: 3,
      constraintPreset: "smooth",
      turnPattern: { blue: [0, 1.5], red: [0.5] },
    });

    const steps = result.sequence.slice(1) as never as Array<{
      motions: { blue: { turns: unknown }; red: { turns: unknown } };
    }>;

    // The word is 16 letters; bridges make the sequence longer than that.
    expect(steps.length).toBeGreaterThan(16);

    for (const [i, step] of steps.entries()) {
      expect(step.motions.blue.turns, `blue step ${i}`).toBeDefined();
      expect(step.motions.red.turns, `red step ${i}`).toBeDefined();
    }
  });

  it("repeats the period across the whole sequence", () => {
    const result = builder().build({
      word: "ABCD",
      gridMode: "diamond",
      level: 3,
      constraintPreset: "smooth",
      turnPattern: { blue: [0, 2], red: [1] },
    });

    const steps = result.sequence.slice(1) as never as Array<{
      motions: { blue: { turns: unknown }; red: { turns: unknown } };
    }>;

    for (const [i, step] of steps.entries()) {
      expect(step.motions.red.turns, `red step ${i}`).toBe(1);
    }
  });
});
```

- [ ] **Step 2: Run to verify it passes**

Run: `npx vitest run packages/sequence-engine/tests/generation/turn-pattern-build.test.ts`
Expected: PASS, 2 tests. If step 1 fails on `toBeDefined`, the source is not reaching materialization; recheck Task 3 Step 4.

- [ ] **Step 3: Commit**

```bash
git commit -m "test(engine): a turn pattern covers the bridge steps random allocation misses" -- packages/sequence-engine/tests/generation/turn-pattern-build.test.ts
```

---

## Phase B — Layer prediction

### Task 5: Predict a signature before anything is generated

**Files:**
- Create: `src/lib/shared/create/domain/layer-prediction.ts`
- Test: `src/lib/shared/create/domain/__tests__/layer-prediction.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { predictLayerSignature } from "../layer-prediction";

describe("predictLayerSignature", () => {
  it("holds layer 1 when no prop ever crosses", () => {
    // Whole turns keep a prop where it is, so nothing leaves radial.
    expect(
      predictLayerSignature({
        blueStartOrientation: "in",
        redStartOrientation: "in",
        lanes: { blue: [1], red: [2] },
        length: 4,
      })
    ).toEqual({ signature: "1111", uncertain: false });
  });

  it("crosses on a half turn", () => {
    // Blue takes a half turn every step, red never does: 1 → 3 → 1 → 3.
    expect(
      predictLayerSignature({
        blueStartOrientation: "in",
        redStartOrientation: "in",
        lanes: { blue: [0.5], red: [0] },
        length: 4,
      })
    ).toEqual({ signature: "3131", uncertain: false });
  });

  it("starts from the layer the orientations describe", () => {
    // Both props start non-radial, which is layer 2.
    expect(
      predictLayerSignature({
        blueStartOrientation: "clock",
        redStartOrientation: "clock",
        lanes: { blue: [0], red: [0] },
        length: 2,
      })
    ).toEqual({ signature: "22", uncertain: false });
  });

  it("admits it cannot know when a float is involved", () => {
    // A float crosses only on a cw/ccw hand path, which depends on the letter,
    // and no letter has been chosen yet.
    const result = predictLayerSignature({
      blueStartOrientation: "in",
      redStartOrientation: "in",
      lanes: { blue: ["fl"], red: [0] },
      length: 2,
    });
    expect(result.uncertain).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/shared/create/domain/__tests__/layer-prediction.test.ts`
Expected: FAIL, cannot resolve `../layer-prediction`

- [ ] **Step 3: Write the implementation**

```ts
/**
 * What layers a sequence will walk through, worked out before it exists.
 *
 * A sequence's layer signature is its starting layer plus, step by step,
 * which props crossed between radial and non-radial. The starting layer comes
 * from the two start orientations and the crossings come from the turns, and
 * neither depends on which letters get chosen. So both halves are known while
 * the user is still setting up the generator, and the signature can be shown
 * before they press the button.
 *
 * The one thing that cannot be known ahead of time is a float. A float takes a
 * prop across only when its hand travels around the circle, and which way the
 * hand travels is a property of the letter. Those steps are reported as
 * uncertain rather than guessed at.
 */

import {
  applyFlip,
  formatSignature,
  layerOf,
  type FlipVector,
  type LayerId,
} from "@tka/sequence-engine";
import type { TurnValue } from "$lib/shared/create/domain/turn-pattern-data";

export interface LayerPredictionInput {
  readonly blueStartOrientation: string;
  readonly redStartOrientation: string;
  readonly lanes: { readonly blue: readonly TurnValue[]; readonly red: readonly TurnValue[] };
  /** How many steps to project the period across. */
  readonly length: number;
}

export interface LayerPrediction {
  /** Layers per step, e.g. "3131". Empty when there is nothing to show. */
  readonly signature: string;
  /** True when a float made at least one step unknowable. */
  readonly uncertain: boolean;
}

/** A prop crosses on a half turn and stays put on a whole one. */
function crosses(turn: TurnValue | undefined): boolean {
  return typeof turn === "number" && !Number.isInteger(turn);
}

function flipFor(blue: TurnValue | undefined, red: TurnValue | undefined): FlipVector {
  const b = crosses(blue);
  const r = crosses(red);
  if (b && r) return "X";
  if (b) return "B";
  if (r) return "R";
  return ".";
}

export function predictLayerSignature(input: LayerPredictionInput): LayerPrediction {
  const { blue, red } = input.lanes;
  const start = layerOf(input.blueStartOrientation, input.redStartOrientation);

  if (!start || blue.length === 0 || red.length === 0 || input.length <= 0) {
    return { signature: "", uncertain: false };
  }

  const layers: LayerId[] = [];
  let current: LayerId = start;
  let uncertain = false;

  for (let i = 0; i < input.length; i++) {
    const b = blue[i % blue.length];
    const r = red[i % red.length];
    if (b === "fl" || r === "fl") uncertain = true;
    current = applyFlip(current, flipFor(b, r));
    layers.push(current);
  }

  return { signature: formatSignature(layers), uncertain };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/shared/create/domain/__tests__/layer-prediction.test.ts`
Expected: PASS, 4 tests

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(create): work out a layer signature before the sequence exists" -- src/lib/shared/create/domain/layer-prediction.ts src/lib/shared/create/domain/__tests__/layer-prediction.test.ts
```

---

## Phase C — The Turns card

### Task 6: The layer readout component

**Files:**
- Create: `src/lib/features/create/generate/components/cards/LayerReadout.svelte`

- [ ] **Step 1: Write the component**

```svelte
<!--
LayerReadout.svelte - the layers a generated sequence will walk through.

Shown under the turn strip so the effect of a turn choice is visible while it
is being made rather than after generating. Hidden by its parent below level 3,
where every sequence sits in layer 1 from beginning to end and the reading
carries no information.
-->
<script lang="ts">
  let {
    signature,
    uncertain = false,
  }: { signature: string; uncertain?: boolean } = $props();
</script>

{#if signature}
  <div class="readout" aria-live="polite">
    <span class="label">Layers</span>
    <span class="value" class:uncertain>{signature}</span>
    {#if uncertain}
      <span class="note">float, depends on the letters</span>
    {/if}
  </div>
{/if}

<style>
  .readout {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
  }

  .label {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
  }

  /* Digits must not jitter as the strip is edited. */
  .value {
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.08em;
    color: var(--theme-text, #fff);
  }

  .value.uncertain {
    opacity: 0.7;
  }

  .note {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    font-size: 0.75rem;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(create): a readout of the layers a turn pattern will produce" -- src/lib/features/create/generate/components/cards/LayerReadout.svelte
```

---

### Task 7: TurnsCard with two modes

**Files:**
- Create: `src/lib/features/create/generate/components/cards/TurnsCard.svelte`
- Delete: `src/lib/features/create/generate/components/cards/TurnIntensityCard.svelte`
- Modify: `src/lib/features/create/generate/components/CardBasedSettingsContainer.svelte:54,647-652`

- [ ] **Step 1: Create TurnsCard**

It keeps the whole of `TurnIntensityCard`'s colour and description logic. Copy that file to `TurnsCard.svelte` first, then add the mode switch, the strip, and the readout around the existing `StepperCard` render.

New props beyond the existing five:

```ts
  let {
    currentIntensity,
    allowedValues,
    onIntensityChange,
    // New:
    level,
    turnPattern,
    onTurnPatternChange,
    blueStartOrientation,
    redStartOrientation,
    sequenceLength,
    loopPeriod,
    patternDisabledReason,
    // Existing chrome props unchanged:
    brightBackgroundOverride,
    shadowColor = "0deg 0% 0%",
    gridColumnSpan = 2,
    cardIndex = 0,
    headerFontSize = "9px",
  } = $props<{
    currentIntensity: number;
    allowedValues: number[];
    onIntensityChange: (intensity: number) => void;
    level: number;
    /** Undefined means Intensity mode. */
    turnPattern: TurnLanes | undefined;
    onTurnPatternChange: (lanes: TurnLanes | undefined) => void;
    blueStartOrientation: string;
    redStartOrientation: string;
    sequenceLength: number;
    /** When a LOOP is active, periods restrict to divisors of this. */
    loopPeriod?: number;
    /** Set when Pattern mode cannot be used, e.g. the isolation preset. */
    patternDisabledReason?: string;
    brightBackgroundOverride?: boolean;
    shadowColor?: string;
    gridColumnSpan?: number;
    cardIndex?: number;
    headerFontSize?: string;
  }>();
```

Body additions:

```ts
  import PatternStripEditor from "$lib/shared/create/components/pattern-strip/PatternStripEditor.svelte";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import LayerReadout from "./LayerReadout.svelte";
  import { PER_HAND_RHYTHMS } from "$lib/shared/create/domain/rhythm/rhythm-catalog";
  import type { StripBinding, StripValue } from "$lib/shared/create/components/pattern-strip/pattern-strip-types";
  import { getTurnPool, type TurnLanes, type TurnValue } from "@tka/sequence-engine";
  import { predictLayerSignature } from "$lib/shared/create/domain/layer-prediction";

  type Mode = "intensity" | "pattern";
  let mode = $state<Mode>("intensity");

  // The strip may only offer values this level actually has. getTurnPool is the
  // single owner of that answer, so a half turn cannot be drawn into a level 2
  // sequence just because it happens to be under the intensity cap.
  const turnValues = $derived(
    getTurnPool(level, currentIntensity, { allowFloat: level >= 3 }) as StripValue[]
  );

  const binding = $derived<StripBinding>({
    lanes: 2,
    rhythms: PER_HAND_RHYTHMS,
    valueList: turnValues,
    amountList: turnValues.filter((v): v is number => typeof v === "number" && v > 0),
    base: 0,
    format: (v) => (v === "fl" ? "float" : String(v)),
    laneColors: ["blue", "red"],
    laneLabels: ["Blue", "Red"],
  });

  // Periods offered by the editor are divisors of whatever length it is given.
  // Handing it the LOOP period is therefore the whole of the LOOP restriction:
  // turns then repeat in lockstep with the shape instead of drifting past it.
  const stripLength = $derived(loopPeriod ?? sequenceLength);

  const lanes = $derived<StripValue[][]>(
    turnPattern
      ? [[...turnPattern.blue], [...turnPattern.red]]
      : [[0], [0]]
  );

  const prediction = $derived(
    turnPattern
      ? predictLayerSignature({
          blueStartOrientation,
          redStartOrientation,
          lanes: turnPattern,
          length: sequenceLength,
        })
      : { signature: "", uncertain: false }
  );

  // Below level 3 there are no half turns and only radial starts, so the
  // signature is always all ones and says nothing worth reading.
  const showReadout = $derived(level >= 3 && mode === "pattern");

  // StripValue also admits booleans, for strips whose cells are toggles. This
  // strip's cells are turn values, so anything else is dropped rather than
  // cast, which would hand the engine a boolean where it expects a turn.
  function toTurnLane(lane: StripValue[]): TurnValue[] {
    return lane.filter((v): v is TurnValue => typeof v === "number" || v === "fl");
  }

  function handleStripChange(next: StripValue[][]) {
    onTurnPatternChange({
      blue: toTurnLane(next[0] ?? []),
      red: toTurnLane(next[1] ?? []),
    });
  }

  function handleModeChange(next: Mode) {
    mode = next;
    // Leaving Pattern mode clears the pattern so generation goes back to
    // rolling turns at random rather than silently keeping the last strip.
    onTurnPatternChange(next === "pattern" ? { blue: [0], red: [0] } : undefined);
  }
```

Markup, wrapping the existing `<StepperCard ... />` unchanged inside the intensity branch:

```svelte
<div class="turns-card">
  <SegmentedControl
    options={[
      { value: "intensity", label: "Intensity" },
      {
        value: "pattern",
        label: "Pattern",
        disabled: Boolean(patternDisabledReason),
        ariaLabel: patternDisabledReason ?? "Pattern",
      },
    ]}
    value={mode}
    onchange={handleModeChange}
    size="sm"
    ariaLabel="Turn mode"
  />

  {#if mode === "intensity"}
    <StepperCard
      title={t("generator_turn_intensity")}
      currentValue={currentIntensity}
      {minValue}
      {maxValue}
      onIncrement={handleIncrement}
      onDecrement={handleDecrement}
      {formatValue}
      {description}
      color={dynamicColor}
      {shadowColor}
      {textColor}
      {gridColumnSpan}
      {cardIndex}
      {headerFontSize}
    />
  {:else}
    <PatternStripEditor
      {binding}
      sequenceLength={stripLength}
      value={lanes}
      onChange={handleStripChange}
    />
    {#if showReadout}
      <LayerReadout signature={prediction.signature} uncertain={prediction.uncertain} />
    {/if}
  {/if}

  {#if patternDisabledReason}
    <p class="disabled-note">{patternDisabledReason}</p>
  {/if}
</div>
```

- [ ] **Step 2: Swap the card in the container**

In `CardBasedSettingsContainer.svelte`:

Line 54, change the import:

```ts
  import TurnsCard from "./cards/TurnsCard.svelte";
```

Line 394, add a pattern handler beside `handleTurnIntensityChange`:

```ts
  function handleTurnPatternChange(turnPattern: TurnLanes | undefined) {
    updateConfig({ turnPattern });
  }
```

Lines 647-652, the render block:

```svelte
          {:else if card.id === "turn-intensity"}
            <!-- TurnsCard declares shadowColor but no color prop. -->
            <TurnsCard
              {...card.props as ComponentProps<typeof TurnsCard>}
              shadowColor={cardColors.turnIntensity.shadowColor}
              level={config.level}
              turnPattern={config.turnPattern}
              onTurnPatternChange={handleTurnPatternChange}
              blueStartOrientation={startEndState?.options.blueStartOrientation ?? "in"}
              redStartOrientation={startEndState?.options.redStartOrientation ?? "in"}
              sequenceLength={config.length}
              loopPeriod={config.loopType ? config.period : undefined}
              {patternDisabledReason}
            />
```

Keep the card id `"turn-intensity"` so saved setups, presets, `cardColors.turnIntensity`, the tour entry, and the `[data-card-id="turn-intensity"]` style rule at line 934 all keep resolving.

Add `turnPattern?: TurnLanes` to `UIGenerationConfig`.

**Level 1 needs no work here.** The CardConfigurator already hides `turn-intensity` at level 1, documented at `card-registry.ts:29`. Do not add a second gate.

- [ ] **Step 3: Delete the old card**

```bash
git rm src/lib/features/create/generate/components/cards/TurnIntensityCard.svelte
```

- [ ] **Step 4: Typecheck**

Run: `npm run check:fast`
Expected: no errors referencing TurnIntensityCard.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(create): the turns card carries a pattern, not just a cap" -- src/lib/features/create/generate/components/cards/TurnsCard.svelte src/lib/features/create/generate/components/cards/TurnIntensityCard.svelte src/lib/features/create/generate/components/CardBasedSettingsContainer.svelte
```

---

### Task 8: Pass the pattern to the engine, and block it under isolation

**Files:**
- Modify: `src/lib/shared/create/services/generation-orchestrator.ts:130,201`

- [ ] **Step 1: Forward the pattern at both build sites**

Beside the existing `maxTurnIntensity: options.turnIntensity,` at line 130 and line 201:

```ts
      maxTurnIntensity: options.turnIntensity,
      turnPattern: options.turnPattern,
```

Add `turnPattern?: TurnLanes` to the orchestrator's options type.

- [ ] **Step 2: Disable Pattern mode under isolation**

The `isolation` preset pins `turns: 0` and is itself a turn specification. In `CardBasedSettingsContainer.svelte`, beside the other `$derived` values near the top of the script:

```ts
  const patternDisabledReason = $derived(
    config.constraintPreset === "isolation"
      ? "The isolation style already fixes turns at zero."
      : undefined
  );
```

Task 7 Step 2 already passes it to `TurnsCard`.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(create): send the turn pattern to the generator" -- src/lib/shared/create/services/generation-orchestrator.ts src/lib/features/create/generate/components/CardBasedSettingsContainer.svelte
```

---

### Task 8b: Round the pattern when the level drops

A half turn drawn at level 3 is not a legal level 2 value. `handleLevelChange`
already clamps the scalar `turnIntensity` this way at
`CardBasedSettingsContainer.svelte:348`; the pattern needs the same treatment
directly beneath it.

**Files:**
- Create test: `src/lib/shared/create/domain/__tests__/turn-pattern-level.test.ts`
- Modify: `src/lib/shared/create/domain/turn-pattern-data.ts` (add the helper)
- Modify: `src/lib/features/create/generate/components/CardBasedSettingsContainer.svelte:348`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { clampLanesToLevel } from "../turn-pattern-data";

describe("clampLanesToLevel", () => {
  it("rounds a half turn to the nearest whole one when dropping to level 2", () => {
    expect(clampLanesToLevel({ blue: [0.5, 1.5, 2], red: [2.5] }, 2, 3)).toEqual({
      blue: [1, 2, 2],
      red: [3],
    });
  });

  it("turns a float into no turn at all below level 3", () => {
    // Level 2 has no float, and rounding it to a spin would invent a value the
    // user never drew.
    expect(clampLanesToLevel({ blue: ["fl"], red: [0] }, 2, 3)).toEqual({
      blue: [0],
      red: [0],
    });
  });

  it("leaves a level 3 pattern alone", () => {
    const lanes = { blue: [0.5, "fl" as const], red: [1.5] };
    expect(clampLanesToLevel(lanes, 3, 3)).toEqual(lanes);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/shared/create/domain/__tests__/turn-pattern-level.test.ts`
Expected: FAIL, `clampLanesToLevel` is not exported

- [ ] **Step 3: Add the helper to `turn-pattern-data.ts`**

```ts
import { getTurnPool } from "@tka/sequence-engine";

export interface TurnLanesValue {
  readonly blue: readonly TurnValue[];
  readonly red: readonly TurnValue[];
}

/**
 * Bring a drawn pattern into the values a level actually has.
 *
 * Levels differ in which turns exist at all: level 2 has whole ones and level 3
 * adds halves and floats. Dropping a level therefore has to do something with
 * the halves already on the strip, and quietly leaving them there would produce
 * a sequence that is not the level it claims to be. A half becomes the nearest
 * whole turn, keeping the rhythm the user drew as close as the level allows,
 * and a float becomes no turn rather than being rounded into a spin nobody
 * asked for.
 */
export function clampLanesToLevel(
  lanes: TurnLanesValue,
  level: number,
  maxTurnIntensity: number
): { blue: TurnValue[]; red: TurnValue[] } {
  const pool = getTurnPool(level, maxTurnIntensity, { allowFloat: level >= 3 });
  const numeric = pool.filter((t): t is number => typeof t === "number");
  const allowsFloat = pool.includes("fl");

  const clamp = (lane: readonly TurnValue[]): TurnValue[] =>
    lane.map((value) => {
      if (value === "fl") return allowsFloat ? "fl" : 0;
      if (pool.includes(value)) return value;
      if (numeric.length === 0) return 0;
      return numeric.reduce((best, candidate) =>
        Math.abs(candidate - value) < Math.abs(best - value) ? candidate : best
      );
    });

  return { blue: clamp(lanes.blue), red: clamp(lanes.red) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/shared/create/domain/__tests__/turn-pattern-level.test.ts`
Expected: PASS, 3 tests

- [ ] **Step 5: Call it on level change**

In `CardBasedSettingsContainer.svelte`, directly after the existing
`turnIntensity` clamp block that ends at line 355:

```ts
    // The strip is subject to the same level rules as the scalar above.
    if (config.turnPattern) {
      updates.turnPattern = clampLanesToLevel(
        config.turnPattern,
        newLevelNum,
        (updates.turnIntensity ?? config.turnIntensity) as number
      );
    }
```

The existing undo toast already restores `turnIntensity`; add `turnPattern:
config.turnPattern` to that same `updateConfig` call in the toast's `onClick` so
a level change stays fully reversible.

- [ ] **Step 6: Commit**

```bash
git commit -m "fix(create): a level drop rounds the turn strip instead of leaving illegal turns on it" -- src/lib/shared/create/domain/turn-pattern-data.ts src/lib/shared/create/domain/__tests__/turn-pattern-level.test.ts src/lib/features/create/generate/components/CardBasedSettingsContainer.svelte
```

---

## Phase D — Start orientation

### Task 9: PropOrientationControl becomes a SegmentedControl

**Files:**
- Modify: `src/lib/features/create/shared/components/sequence-actions/PropOrientationControl.svelte`
- Modify: `src/lib/features/create/shared/components/sequence-actions/PropOrientationControl.svelte.test.ts`

- [ ] **Step 1: Replace the stepper**

Keep the existing props (`color`, `orientation`, `allowedOrientations`, `onOrientationChange`) so both consumers are unaffected.

```svelte
<script lang="ts">
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import type { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

  let {
    color,
    orientation,
    allowedOrientations,
    onOrientationChange,
  }: {
    color: "blue" | "red";
    orientation: Orientation;
    allowedOrientations: readonly Orientation[];
    onOrientationChange: (next: Orientation) => void;
  } = $props();

  const LABELS: Record<string, string> = {
    in: "In",
    out: "Out",
    clock: "Clock",
    counter: "Counter",
  };

  const options = $derived(
    allowedOrientations.map((value) => ({
      value,
      label: LABELS[value] ?? String(value),
      tone: color,
    }))
  );
</script>

<SegmentedControl
  {options}
  value={orientation}
  onchange={onOrientationChange}
  {color}
  size="sm"
  semantics="radiogroup"
  ariaLabel={color === "blue" ? "Blue start orientation" : "Red start orientation"}
/>
```

- [ ] **Step 2: Update the component test**

The existing test drives increment and decrement buttons. Replace those interactions with direct option selection:

```ts
  it("selects an orientation directly instead of stepping to it", async () => {
    const onOrientationChange = vi.fn();
    render(PropOrientationControl, {
      color: "blue",
      orientation: "in",
      allowedOrientations: ["in", "out", "clock", "counter"],
      onOrientationChange,
    });

    // Every choice is visible and one click away, which is the point of the change.
    await page.getByRole("radio", { name: "Counter" }).click();
    expect(onOrientationChange).toHaveBeenCalledWith("counter");
  });
```

- [ ] **Step 3: Run the component test**

Run: `npx vitest run src/lib/features/create/shared/components/sequence-actions/PropOrientationControl.svelte.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git commit -m "fix(create): show every start orientation instead of stepping through them" -- src/lib/features/create/shared/components/sequence-actions/PropOrientationControl.svelte src/lib/features/create/shared/components/sequence-actions/PropOrientationControl.svelte.test.ts
```

---

### Task 10: Fold start orientation into the Start Position drill

**Files:**
- Modify: `src/lib/features/create/generate/components/cards/CustomizeExpandedOverlay.svelte:236,368-409,539-547`

- [ ] **Step 1: Remove the drill row**

Delete the `{ id: "startOri", label: "Start Orientation", value: oriDisplay },` entry at line 236. The root list goes from four rows to three.

- [ ] **Step 2: Move the control under the position grid**

Replace the `startPos` branch (lines 368-377) so the grid keeps its space and the orientation rows sit beneath it:

```svelte
        {:else if id === "startPos"}
          <div class="drill-fill grid-fill">
            <MultiSelectPositionPicker
              blockedPositions={localBlockedPositions}
              onBlockedChange={handleBlockedChange}
              blueStartOrientation={localBlueOri}
              redStartOrientation={localRedOri}
              presets={startPositionPresets}
              {gridMode}
            />
            <div class="ori-block">
              <div class="ori-row">
                <span class="ori-color-label ori-blue">Blue</span>
                <PropOrientationControl
                  color="blue"
                  orientation={localBlueOri}
                  allowedOrientations={availableStartOrientations}
                  onOrientationChange={handleBlueOriChange}
                />
              </div>
              <div class="ori-row">
                <span class="ori-color-label ori-red">Red</span>
                <PropOrientationControl
                  color="red"
                  orientation={localRedOri}
                  allowedOrientations={availableStartOrientations}
                  onOrientationChange={handleRedOriChange}
                />
              </div>
            </div>
          </div>
```

- [ ] **Step 3: Delete the `startOri` branch**

Remove lines 388-409, the whole `{:else if id === "startOri"}` block. It has no row to reach it now.

- [ ] **Step 4: Add the grouping style**

Beside the existing `.ori-row` rule:

```css
  /* The grid is square and capped by the panel's width, so it cannot eat the
     leftover height anyway. These rows take the space under it rather than
     getting a near-empty panel of their own. */
  .ori-block {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 14px;
  }
```

- [ ] **Step 5: Typecheck**

Run: `npm run check:fast`
Expected: no errors. `oriDisplay` may now be unused; remove it if so.

- [ ] **Step 6: Commit**

```bash
git commit -m "fix(create): start orientation sits with the grid that draws it" -- src/lib/features/create/generate/components/cards/CustomizeExpandedOverlay.svelte
```

---

## Phase E — Verification

### Task 11: Test the three claims the spec actually makes

Each of these carries a load-bearing argument from the spec. Without them the
design's central claims are asserted rather than demonstrated.

**Files:**
- Create: `packages/sequence-engine/tests/generation/turn-pattern-claims.test.ts`
- Create: `src/lib/shared/create/domain/__tests__/loop-period-strip.test.ts`

- [ ] **Step 1: The predicted readout matches what the builder produces**

Reuse the harness from Task 4 (the same `beforeAll`, `CsvVariationProvider`,
`loadVariations`, `builder()` copied from `layer-pattern-build.test.ts`). This is
the letter-independence claim carried into the app: the number shown before
generating is the number the sequence comes back with.

```ts
import { formatSignature, layerSignature } from "../../src/core/orientation/layer-signature.js";

describe("the readout tells the truth", () => {
  it("predicts the signature the builder goes on to produce", () => {
    const lanes = { blue: [0.5, 0], red: [0, 0] };

    for (const word of ["ABCD", "WXYZ", "JKLM"]) {
      const result = builder().build({
        word,
        gridMode: "diamond",
        level: 3,
        constraintPreset: "smooth",
        turnPattern: lanes,
        blueStartOrientation: "in",
        redStartOrientation: "in",
      });

      const built = formatSignature(layerSignature(result.sequence.slice(1) as never));

      // The app's prediction, computed with no sequence in hand at all.
      const predicted = predictLayerSignature({
        blueStartOrientation: "in",
        redStartOrientation: "in",
        lanes,
        length: built.length,
      });

      expect(predicted.signature, word).toBe(built);
    }
  });
});
```

`predictLayerSignature` lives in `src/`, so import it by relative path from the
engine test, or move the assertion into a `tests/unit/` test that imports both.
Prefer the latter if the engine package's tsconfig will not resolve `src/`.

- [ ] **Step 2: A zeroed index gets no Type 6 letter**

This is the whole reason the pattern goes into the build instead of onto the
result. Type 6 is the static family: lowercase Greek alpha, beta, gamma.

```ts
const TYPE_6 = new Set(["α", "β", "γ"]);

it("does not place a static letter where the pattern says no turns", () => {
  // Every odd index is zeroed for both props. A Type 6 step there would be a
  // step in which nothing whatsoever happens.
  const result = builder().build({
    word: "ABCDABCD",
    gridMode: "diamond",
    level: 3,
    constraintPreset: "smooth",
    turnPattern: { blue: [1.5, 0], red: [1.5, 0] },
  });

  const steps = result.sequence.slice(1) as never as Array<{ letter: string }>;
  for (const [i, step] of steps.entries()) {
    if (i % 2 === 1) {
      expect(TYPE_6.has(step.letter), `step ${i} is ${step.letter}`).toBe(false);
    }
  }
});
```

- [ ] **Step 3: LOOP periods admit only divisors**

```ts
import { describe, expect, it } from "vitest";
import { divisorsUpTo } from "$lib/shared/create/components/pattern-strip/pattern-strip-math";

describe("strip periods under a LOOP", () => {
  it("offers only periods that divide the LOOP evenly", () => {
    // Handing the editor the LOOP period is the whole mechanism: it already
    // offers divisors of whatever length it is given, so a period that would
    // drift against the shape is never on the menu.
    expect(divisorsUpTo(8)).toEqual([1, 2, 4, 8]);
    expect(divisorsUpTo(6)).toEqual([1, 2, 3, 6]);
  });
});
```

Confirm the import path and exact return shape of `divisorsUpTo` before writing
this; it is used by `PatternStripEditor` and may be colocated rather than in a
separate math module. Adjust the expected arrays to its real output if it
includes or excludes the bounds differently.

- [ ] **Step 4: Run them**

Run: `npx vitest run packages/sequence-engine/tests/generation/turn-pattern-claims.test.ts src/lib/shared/create/domain/__tests__/loop-period-strip.test.ts`
Expected: PASS

If Step 2 fails, the pattern is reaching materialization but not the constraint
context during search. Recheck Task 2: `enrichWithTurns` must be applying pattern
turns to each variation *before* scoring, not after selection.

- [ ] **Step 5: Commit**

```bash
git commit -m "test(create): the readout matches the build, and a zeroed step gets no static letter" -- packages/sequence-engine/tests/generation/turn-pattern-claims.test.ts src/lib/shared/create/domain/__tests__/loop-period-strip.test.ts
```

---

### Task 12: Full check and visual pass

- [ ] **Step 1: Full typecheck and tests**

Run: `npm run check > /tmp/check.log 2>&1; grep -niE "error" /tmp/check.log`
Expected: no errors. One check run only per `fast-iteration-loop.md`.

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 2: Screenshot the Turns card in both modes**

Both are changes to size, count, and structure, so `visual-verification-mandatory.md` fires. Do not ask permission; this is part of the edit.

Start or reuse the shared browser:

```bash
pwsh -NoProfile -File scripts/launch-chrome-debug.ps1 -Url about:blank
```

Open a task-owned background page at `https://localhost:5173/create/generate`, keep its page ID, and for each viewport call `emulate` with `<width>x<height>x1` then `take_screenshot` with `format: "webp", quality: 70`:

1920x1080, 2560x1440, 3840x2160, 1440x900, 820x1180, 960x412, 375x667.

Check each frame against the list in the rule. The specific risk here: `SegmentedControl` has a documented failure where a shared primitive's `width: 100%` defeats a consumer's `flex: 0 0 auto`. Two short labels stretched across the panel is the exact bug that rule was written for. Measure it rather than eyeballing:

```js
[...document.querySelectorAll('[role="radiogroup"], [aria-label="Turn mode"]')]
  .map(el => ({ label: el.getAttribute('aria-label'), width: el.getBoundingClientRect().width }))
```

- [ ] **Step 3: Screenshot the Start Position drill**

Same viewports. Confirm the orientation rows read as one group with the grid, that nothing is stranded, and that no near-empty panel remains.

- [ ] **Step 4: Check the other consumer of the control**

`PropOrientationControl` is also rendered by `StartPositionEditMode.svelte`, in a
different container. The props are unchanged so it compiles either way, but a
stepper and a four-option segmented control are not the same width. Open that
surface and screenshot it at 1920 and 375. If the row now overflows, give the
control a wrapping container there rather than reintroducing the stepper.

- [ ] **Step 5: Commit any fixes the frames demand**

```bash
git commit -m "fix(create): <what the screenshots showed>" -- <paths>
```

---

## Out of scope

Saved and named turn patterns in Generate, direct layer-pattern authoring through `targetLayerPattern`, fixing eager random allocation for bridged words, and deliberate rest steps. All four are recorded in the spec with reasons.
