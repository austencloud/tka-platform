# Pending-Turns Bar above the Option Picker — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent turns bar (blue + red, turns-only) above the construct-tab option picker; dialing turns re-renders every option with the turns applied and end orientation recomputed, and picking appends the option with turns baked in.

**Architecture:** Sticky `blueTurns`/`redTurns` state lives in `OptionPicker.svelte`. Each option is run through a pure `applyPendingTurnsToOption` transform (extracted from the existing `turn-pattern-manager` turn logic) before `prepareBatch`, so the rendered + selected pictographs carry the turns. The bar is a thin composition of the existing `PropControlPair` + `PropTurnsControl` primitives mounted in `OptionPickerContent`, desktop-only.

**Tech Stack:** Svelte 5 (runes), TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-16-pending-turns-option-picker-design.md`

**Note:** All work on `main` (project rule — no worktrees/branches). Commit each task with an explicit pathspec (shared index may hold other agents' work).

---

## File Structure

| Action | Path | Responsibility |
|---|---|---|
| Create | `src/lib/shared/create/services/apply-turns-to-motion.ts` | Pure turn→motion transform (moved from turn-pattern-manager) + `applyPendingTurnsToOption` |
| Create | `src/lib/shared/create/services/apply-turns-to-motion.test.ts` | Unit tests for the transform |
| Create | `src/lib/features/create/construct/option-picker/components/PendingTurnsBar.svelte` | Blue+red turns-only bar (composition) |
| Modify | `src/lib/shared/create/services/turn-pattern-manager.ts` | Import the extracted helper; delete the moved functions |
| Modify | `src/lib/features/create/construct/option-picker/components/OptionPicker.svelte` | Sticky turns state + `prepareWithTurns` + pass props down |
| Modify | `src/lib/features/create/construct/option-picker/components/OptionPickerContent.svelte` | Mount `PendingTurnsBar` above grids, desktop-only |

---

### Task 1: Extract the turn transform + add `applyPendingTurnsToOption`

**Files:**
- Create: `src/lib/shared/create/services/apply-turns-to-motion.ts`
- Create: `src/lib/shared/create/services/apply-turns-to-motion.test.ts`
- Modify: `src/lib/shared/create/services/turn-pattern-manager.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/shared/create/services/apply-turns-to-motion.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import {
  MotionType,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";

// Deterministic orientation: "in" at 0 turns, "out" otherwise — lets us assert
// that turns flow through to an end-orientation recompute.
vi.mock("$lib/shared/pictograph/prop/services/orientation-calculator", () => ({
  calculateEndOrientation: (m: { turns: number | "fl" }) =>
    m.turns === 0 || m.turns === "fl" ? "in" : "out",
}));

import { applyPendingTurnsToOption } from "./apply-turns-to-motion";

function makeOption(): PictographData {
  return {
    letter: "A",
    motions: {
      blue: createMotionData({
        motionType: MotionType.PRO,
        rotationDirection: RotationDirection.CLOCKWISE,
        turns: 0,
        startOrientation: "in",
        endOrientation: "in",
        startLocation: "s",
        endLocation: "e",
      }),
      red: createMotionData({
        motionType: MotionType.PRO,
        rotationDirection: RotationDirection.COUNTER_CLOCKWISE,
        turns: 0,
        startOrientation: "in",
        endOrientation: "in",
        startLocation: "n",
        endLocation: "w",
      }),
    },
  } as unknown as PictographData;
}

describe("applyPendingTurnsToOption", () => {
  it("applies turns per hand and recomputes end orientation", () => {
    const result = applyPendingTurnsToOption(makeOption(), 1, 0);
    expect(result.motions.blue!.turns).toBe(1);
    expect(result.motions.blue!.endOrientation).toBe("out");
    expect(result.motions.red!.turns).toBe(0);
    expect(result.motions.red!.endOrientation).toBe("in");
  });

  it("returns a new object and does not mutate the input", () => {
    const input = makeOption();
    const result = applyPendingTurnsToOption(input, 1, 1);
    expect(result).not.toBe(input);
    expect(input.motions.blue!.turns).toBe(0);
  });

  it("returns the option unchanged when a motion is missing", () => {
    const input = { letter: "A", motions: { blue: undefined, red: undefined } } as unknown as PictographData;
    expect(applyPendingTurnsToOption(input, 1, 1)).toBe(input);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/shared/create/services/apply-turns-to-motion.test.ts`
Expected: FAIL — cannot resolve `./apply-turns-to-motion`.

- [ ] **Step 3: Create the extracted module**

Create `src/lib/shared/create/services/apply-turns-to-motion.ts`. This MOVES `applyTurnToMotion`, `findRotationContext`, and `createUpdatedMotion` verbatim out of `turn-pattern-manager.ts` (no behavior change), exports `applyTurnToMotion`, and adds `applyPendingTurnsToOption`:

```ts
/**
 * Pure turn → motion transform.
 *
 * Applies a turn value to a single motion: auto-resolves rotation direction from
 * surrounding context (or the motion's own direction), handles float edge cases,
 * and recomputes end orientation. Extracted from turn-pattern-manager so the
 * construct option picker can apply the same canonical logic to its options.
 */

import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
import type { TurnValue } from "$lib/shared/create/domain/turn-pattern-data";
import {
  createMotionData,
  type MotionData,
} from "$lib/shared/pictograph/shared/domain/models/motion-data";
import {
  MotionColor,
  MotionType,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { calculateEndOrientation } from "$lib/shared/pictograph/prop/services/orientation-calculator";
import { createComponentLogger } from "$lib/shared/utils/debug-logger";

const logger = createComponentLogger("ApplyTurnsToMotion");

/**
 * Apply a turn value to a single motion with edge-case handling.
 */
export function applyTurnToMotion(
  turnValue: TurnValue,
  currentMotion: MotionData,
  color: MotionColor,
  allSteps: readonly StepData[],
  stepIndex: number
): { motion: MotionData | null; warning?: string } {
  const motionType = currentMotion.motionType;

  // Edge case: Float cannot be applied to STATIC or DASH
  if (turnValue === "fl") {
    if (motionType === MotionType.STATIC || motionType === MotionType.DASH) {
      logger.log(`Float cannot be applied to ${motionType}, applying 0 turns`);
      return {
        motion: createUpdatedMotion(currentMotion, 0, color),
        warning: `Float converted to 0 (${motionType} cannot float)`,
      };
    }
  }

  // Handle rotation direction when applying turns > 0 to motion with no rotation
  let rotationDirection = currentMotion.rotationDirection;
  if (
    typeof turnValue === "number" &&
    turnValue > 0 &&
    rotationDirection === RotationDirection.NO_ROTATION
  ) {
    rotationDirection = findRotationContext(allSteps, stepIndex, color);
    if (rotationDirection !== currentMotion.rotationDirection) {
      logger.log(
        `Applied context rotation ${rotationDirection} to beat ${stepIndex + 1} ${color}`
      );
    }
  }

  return {
    motion: createUpdatedMotion(currentMotion, turnValue, color, rotationDirection),
  };
}

/**
 * Find rotation context by searching backwards first, then forwards.
 * Defaults to CLOCKWISE only if no rotation direction is found in either direction.
 */
function findRotationContext(
  steps: readonly StepData[],
  currentStepIndex: number,
  color: MotionColor
): RotationDirection {
  for (let i = currentStepIndex - 1; i >= 0; i--) {
    const beat = steps[i];
    if (!beat) continue;
    const motion = beat.motions?.[color];
    if (motion && motion.rotationDirection !== RotationDirection.NO_ROTATION) {
      logger.log(`Found backward rotation context at beat ${i + 1}: ${motion.rotationDirection}`);
      return motion.rotationDirection;
    }
  }

  for (let i = currentStepIndex + 1; i < steps.length; i++) {
    const beat = steps[i];
    if (!beat) continue;
    const motion = beat.motions?.[color];
    if (motion && motion.rotationDirection !== RotationDirection.NO_ROTATION) {
      logger.log(`Found forward rotation context at beat ${i + 1}: ${motion.rotationDirection}`);
      return motion.rotationDirection;
    }
  }

  logger.log(`No rotation context found for ${color}, defaulting to CLOCKWISE`);
  return RotationDirection.CLOCKWISE;
}

/**
 * Create an updated motion with a new turn value (recomputes end orientation).
 */
function createUpdatedMotion(
  currentMotion: MotionData,
  turnValue: TurnValue,
  color: MotionColor,
  rotationDirection?: RotationDirection
): MotionData {
  const currentTurns = currentMotion.turns;
  const isConvertingToFloat = currentTurns !== "fl" && turnValue === "fl";
  const isConvertingFromFloat = currentTurns === "fl" && turnValue !== "fl";

  let updatedMotionType = currentMotion.motionType;
  let updatedRotationDirection = rotationDirection ?? currentMotion.rotationDirection;
  let updatedPrefloatMotionType = currentMotion.prefloatMotionType;
  let updatedPrefloatRotationDirection = currentMotion.prefloatRotationDirection;

  if (isConvertingToFloat) {
    updatedPrefloatMotionType = currentMotion.motionType;
    updatedPrefloatRotationDirection = currentMotion.rotationDirection;
    updatedMotionType = MotionType.FLOAT;
    updatedRotationDirection = RotationDirection.NO_ROTATION;
  } else if (isConvertingFromFloat) {
    if (currentMotion.prefloatMotionType) {
      updatedMotionType = currentMotion.prefloatMotionType;
    }
    if (currentMotion.prefloatRotationDirection) {
      updatedRotationDirection = currentMotion.prefloatRotationDirection;
    }
  } else {
    const isDashOrStatic =
      updatedMotionType === MotionType.DASH || updatedMotionType === MotionType.STATIC;
    if (isDashOrStatic) {
      if (
        typeof turnValue === "number" &&
        turnValue > 0 &&
        currentMotion.rotationDirection === RotationDirection.NO_ROTATION
      ) {
        updatedRotationDirection = rotationDirection ?? RotationDirection.CLOCKWISE;
      } else if (turnValue === 0) {
        updatedRotationDirection = RotationDirection.NO_ROTATION;
      }
    }
  }

  const tempMotion = createMotionData({
    ...currentMotion,
    turns: turnValue,
    rotationDirection: updatedRotationDirection,
    motionType: updatedMotionType,
  });
  const newEndOrientation = calculateEndOrientation(tempMotion, color);

  return createMotionData({
    ...currentMotion,
    turns: turnValue,
    motionType: updatedMotionType,
    rotationDirection: updatedRotationDirection,
    prefloatMotionType: updatedPrefloatMotionType,
    prefloatRotationDirection: updatedPrefloatRotationDirection,
    endOrientation: newEndOrientation,
  });
}

/**
 * Apply pending turn values to both hands of a single option pictograph.
 *
 * Each option already carries the propagated start orientation (= previous step's
 * end orientation), so no surrounding-step context is needed — rotation falls back
 * to each motion's own direction. Returns a new PictographData; never mutates input.
 */
export function applyPendingTurnsToOption(
  option: PictographData,
  blueTurns: number | "fl",
  redTurns: number | "fl"
): PictographData {
  const blue = option.motions?.blue;
  const red = option.motions?.red;
  if (!blue || !red) return option;

  const blueResult = applyTurnToMotion(blueTurns, blue, MotionColor.BLUE, [], 0);
  const redResult = applyTurnToMotion(redTurns, red, MotionColor.RED, [], 0);

  return {
    ...option,
    motions: {
      ...option.motions,
      blue: blueResult.motion ?? blue,
      red: redResult.motion ?? red,
    },
  };
}
```

- [ ] **Step 4: Refactor `turn-pattern-manager.ts` to import the moved functions**

In `src/lib/shared/create/services/turn-pattern-manager.ts`:

1. DELETE the three function definitions now living in the new module: `applyTurnToMotion` (the `// Apply a turn value to a single motion` block), `findRotationContext`, and `createUpdatedMotion`. Leave `updateMotionStartOrientation` in place — it stays.
2. Add this import near the other imports (after the `calculateEndOrientation` import line):

```ts
import { applyTurnToMotion } from "./apply-turns-to-motion";
```

Everything else in `turn-pattern-manager.ts` is unchanged (`applyPattern` still calls `applyTurnToMotion` exactly as before).

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/shared/create/services/apply-turns-to-motion.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Verify no regression in turn-pattern consumers + types**

Run: `npx vitest run src/lib/features/create/shared/services/step-operations/turns-handler.test.ts`
Expected: PASS (unchanged).

Run: `npm run check > /tmp/check.log 2>&1; grep -niE "apply-turns-to-motion|turn-pattern-manager" /tmp/check.log` (capture once, then grep)
Expected: no errors referencing either file.

- [ ] **Step 7: Commit**

```bash
git add src/lib/shared/create/services/apply-turns-to-motion.ts src/lib/shared/create/services/apply-turns-to-motion.test.ts src/lib/shared/create/services/turn-pattern-manager.ts
git commit -m "refactor(create): extract apply-turns-to-motion + applyPendingTurnsToOption" -- src/lib/shared/create/services/apply-turns-to-motion.ts src/lib/shared/create/services/apply-turns-to-motion.test.ts src/lib/shared/create/services/turn-pattern-manager.ts
```

---

### Task 2: `PendingTurnsBar.svelte`

**Files:**
- Create: `src/lib/features/create/construct/option-picker/components/PendingTurnsBar.svelte`

No unit test — this is presentational composition of two verified primitives (testing skill: skip what's obvious when broken). Verified at runtime in Task 5.

- [ ] **Step 1: Create the component**

Create `src/lib/features/create/construct/option-picker/components/PendingTurnsBar.svelte`:

```svelte
<!--
  PendingTurnsBar.svelte

  Turns-only bar shown above the construct option picker. Two PropTurnsControl
  steppers (blue + red) with no rotation-direction or path-shape controls. Setting
  a value applies those turns to every option in the picker (handled by the parent).
-->
<script lang="ts">
  import PropControlPair from "$lib/features/create/shared/components/sequence-actions/PropControlPair.svelte";
  import PropTurnsControl from "$lib/features/create/shared/components/sequence-actions/PropTurnsControl.svelte";
  import { RotationDirection } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

  interface Props {
    blueTurns: number | "fl";
    redTurns: number | "fl";
    onBlueChange: (delta: number) => void;
    onRedChange: (delta: number) => void;
    onReset: () => void;
  }

  const { blueTurns, redTurns, onBlueChange, onRedChange, onReset }: Props = $props();

  const noop = () => {};
  const isCleared = $derived(blueTurns === 0 && redTurns === 0);
</script>

<div class="pending-turns-bar">
  <div class="bar-header">
    <span class="bar-title">Turns</span>
    <button
      class="reset-btn"
      disabled={isCleared}
      aria-label="Reset turns to 0"
      onclick={onReset}
    >
      <i class="fas fa-rotate-left" aria-hidden="true"></i>
      <span>Reset</span>
    </button>
  </div>

  <PropControlPair>
    {#snippet blueContent()}
      <PropTurnsControl
        color="blue"
        turns={blueTurns}
        rotationDirection={RotationDirection.NO_ROTATION}
        showRotation={false}
        onTurnsChange={onBlueChange}
        onRotationChange={noop}
      />
    {/snippet}
    {#snippet redContent()}
      <PropTurnsControl
        color="red"
        turns={redTurns}
        rotationDirection={RotationDirection.NO_ROTATION}
        showRotation={false}
        onTurnsChange={onRedChange}
        onRotationChange={noop}
      />
    {/snippet}
  </PropControlPair>
</div>

<style>
  .pending-turns-bar {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
    padding: 8px 8px 10px;
  }

  .bar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .bar-title {
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.75px;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.7);
  }

  .reset-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: var(--min-touch-target, 44px);
    padding: 0 12px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.75);
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-fast, 0.15s) ease;
  }

  .reset-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.08);
    color: white;
  }

  .reset-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .reset-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6ea8fe);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .reset-btn {
      transition: none;
    }
  }
</style>
```

- [ ] **Step 2: Type-check the new component**

Run: `npm run check > /tmp/check.log 2>&1; grep -niE "PendingTurnsBar" /tmp/check.log`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/create/construct/option-picker/components/PendingTurnsBar.svelte
git commit -m "feat(option-picker): PendingTurnsBar (turns-only blue/red)" -- src/lib/features/create/construct/option-picker/components/PendingTurnsBar.svelte
```

---

### Task 3: Wire sticky turns + `prepareWithTurns` into `OptionPicker.svelte`

**Files:**
- Modify: `src/lib/features/create/construct/option-picker/components/OptionPicker.svelte`

- [ ] **Step 1: Add the import**

In `OptionPicker.svelte`, add after the existing `pictographPreparer` import (line ~19):

```ts
import { applyPendingTurnsToOption } from "$lib/shared/create/services/apply-turns-to-motion";
```

- [ ] **Step 2: Add sticky turns state + helper**

After the `internalContinuousOnly` state declaration (line ~68), add:

```ts
  // Sticky pending turns applied to every option (persist across selections)
  let blueTurns = $state<number | "fl">(0);
  let redTurns = $state<number | "fl">(0);

  function handleBlueTurnsChange(delta: number) {
    if (blueTurns === "fl") return;
    blueTurns = Math.max(0, blueTurns + delta);
  }
  function handleRedTurnsChange(delta: number) {
    if (redTurns === "fl") return;
    redTurns = Math.max(0, redTurns + delta);
  }
  function handleResetTurns() {
    blueTurns = 0;
    redTurns = 0;
  }

  // Apply sticky turns to each option, then prepare for rendering.
  function prepareWithTurns(
    filtered: PictographData[]
  ): Promise<PreparedPictographData[]> {
    const turned =
      blueTurns === 0 && redTurns === 0
        ? filtered
        : filtered.map((o) => applyPendingTurnsToOption(o, blueTurns, redTurns));
    const s = getSettings();
    return preparer!.prepareBatch(turned, {
      bluePropType: s.bluePropType,
      redPropType: s.redPropType,
    });
  }
```

- [ ] **Step 3: Use `prepareWithTurns` in the reactive prepare effect**

In the prepare `$effect` (lines ~118-156), the turns state must be a dependency and the final `prepareBatch` call replaced. Replace the tail of that effect — from the `const s = getSettings();` line through the `.then(...)` block (lines ~151-155) — with:

```ts
    // Track sticky turns so a turn change re-renders the options
    const _blueTurns = blueTurns;
    const _redTurns = redTurns;
    void _blueTurns;
    void _redTurns;

    prepareWithTurns(filtered).then((prepared) => {
      preparedOptions = prepared;
      isSelecting = false;
    });
```

- [ ] **Step 4: Use `prepareWithTurns` in the `handleSelect` fast path**

In `handleSelect` (lines ~182-201), replace the inner prepare block:

```ts
        if (preparer && filtered.length > 0) {
          const s2 = getSettings();
          const prepared = await preparer.prepareBatch(filtered, { bluePropType: s2.bluePropType, redPropType: s2.redPropType });
          preparedOptions = prepared;
        }
```

with:

```ts
        if (preparer && filtered.length > 0) {
          const prepared = await prepareWithTurns(filtered);
          preparedOptions = prepared;
        }
```

- [ ] **Step 5: Pass turns + callbacks down to `OptionPickerContent`**

In the markup, extend the `<OptionPickerContent ... />` call (lines ~287-298) with these props:

```svelte
    {blueTurns}
    {redTurns}
    onBlueTurnsChange={handleBlueTurnsChange}
    onRedTurnsChange={handleRedTurnsChange}
    onResetTurns={handleResetTurns}
```

- [ ] **Step 6: Type-check**

Run: `npm run check > /tmp/check.log 2>&1; grep -niE "OptionPicker\.svelte" /tmp/check.log`
Expected: errors only about the props `OptionPickerContent` does not yet accept (resolved in Task 4) — or none if Svelte does not flag excess props. Note any other error and fix.

- [ ] **Step 7: Commit**

```bash
git add src/lib/features/create/construct/option-picker/components/OptionPicker.svelte
git commit -m "feat(option-picker): sticky pending turns + prepareWithTurns" -- src/lib/features/create/construct/option-picker/components/OptionPicker.svelte
```

---

### Task 4: Mount the bar in `OptionPickerContent.svelte` (desktop-only)

**Files:**
- Modify: `src/lib/features/create/construct/option-picker/components/OptionPickerContent.svelte`

- [ ] **Step 1: Import the bar**

Add to the component imports (top `<script>` block):

```ts
import PendingTurnsBar from "./PendingTurnsBar.svelte";
```

- [ ] **Step 2: Add the props to the `Props` interface**

Add these fields to the existing `Props` interface in `OptionPickerContent.svelte` (keep existing fields):

```ts
    blueTurns: number | "fl";
    redTurns: number | "fl";
    onBlueTurnsChange: (delta: number) => void;
    onRedTurnsChange: (delta: number) => void;
    onResetTurns: () => void;
```

And destructure them from `$props()` alongside the existing destructured props:

```ts
    blueTurns,
    redTurns,
    onBlueTurnsChange,
    onRedTurnsChange,
    onResetTurns,
```

- [ ] **Step 3: Render the bar above the grids, desktop-only**

In the markup, inside `<div class="animated-content">` and immediately BEFORE the `{#if shouldShowFilterToggle()}` block (line ~322), insert:

```svelte
      {#if !shouldUseSwipeLayout()}
        <PendingTurnsBar
          {blueTurns}
          {redTurns}
          onBlueChange={onBlueTurnsChange}
          onRedChange={onRedTurnsChange}
          onReset={onResetTurns}
        />
      {/if}
```

- [ ] **Step 4: Type-check the whole option-picker surface**

Run: `npm run check > /tmp/check.log 2>&1; grep -niE "option-picker|PendingTurnsBar|OptionPicker" /tmp/check.log`
Expected: no errors.

- [ ] **Step 5: Run the focused unit test again (guards the transform contract)**

Run: `npx vitest run src/lib/shared/create/services/apply-turns-to-motion.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/create/construct/option-picker/components/OptionPickerContent.svelte
git commit -m "feat(option-picker): mount PendingTurnsBar above options (desktop)" -- src/lib/features/create/construct/option-picker/components/OptionPickerContent.svelte
```

---

### Task 5: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Full type-check (cross-file)**

Run: `npm run check > /tmp/check.log 2>&1; grep -niE "error" /tmp/check.log | head -40`
Expected: no new errors attributable to the changed files. Fix any that are, then re-run once.

- [ ] **Step 2: Run the new unit tests + the turns regression tests**

Run: `npx vitest run src/lib/shared/create/services/apply-turns-to-motion.test.ts src/lib/features/create/shared/services/step-operations/turns-handler.test.ts`
Expected: all PASS.

- [ ] **Step 3: Runtime check (dev server already on :5173)**

Confirm the route serves without error:

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/`
Expected: `200`.

Then, with Chrome DevTools MCP (read-only — ask Austen before driving the browser): open the construct tab, place a start position, confirm the Turns bar renders above the option grid, dial blue to 1, and confirm the option pictographs re-render (prop end orientation changes) without the row shifting. If browser verification is not authorized, state: "I can't verify the visual without driving the browser — please open the construct tab, place a start position, set blue turns to 1, and confirm the options re-render with the turn applied."

- [ ] **Step 4: No-layout-shift self-check**

Confirm `.turns-value` keeps a fixed `min-width` (it does, in `PropTurnsControl.svelte`). If the value font jitters between `0`/`0.5`/`fl` during testing, add `font-variant-numeric: tabular-nums;` to `.turns-value` in `PropTurnsControl.svelte` and re-verify. (Apply only if a shift is observed — most digits in this font are tabular already.)

- [ ] **Step 5: Final commit (only if Step 4 changed a file)**

```bash
git add src/lib/features/create/shared/components/sequence-actions/PropTurnsControl.svelte
git commit -m "fix(option-picker): tabular turns value to prevent layout shift" -- src/lib/features/create/shared/components/sequence-actions/PropTurnsControl.svelte
```

---

## Self-Review

**Spec coverage:**
- Sticky turns, appears after start position → Task 3 state + Task 4 desktop render (bar shows whenever OptionPicker is mounted, i.e. once a start position exists). ✓
- Turns-only, no rotation direction → Task 2 `showRotation={false}`. ✓
- Re-render same set with turns applied + orientation recompute → Task 1 `applyPendingTurnsToOption` + Task 3 `prepareWithTurns` as effect dep. ✓
- Pick appends turned option → `PreparedPictographData` is a superset of `PictographData`; transform runs pre-prepare, so `onOptionSelected(option)` carries turned motions. ✓
- Desktop only → Task 4 `!shouldUseSwipeLayout()` guard. ✓
- Reuse primitives, no fork → Tasks 1, 2 reuse `applyTurnToMotion`, `PropControlPair`, `PropTurnsControl`. ✓
- No layout shift → Task 5 Step 4 self-check. ✓
- Cache safety (turned variants don't collide) → confirmed: `deriveCacheKey` includes per-hand `turns`/`rotationDirection`/`endOrientation`. ✓

**Placeholder scan:** none — every code step has full code.

**Type consistency:** `applyPendingTurnsToOption(option, blueTurns, redTurns)`, `prepareWithTurns(filtered)`, prop names `onBlueTurnsChange`/`onRedTurnsChange`/`onResetTurns` (OptionPicker→Content) vs `onBlueChange`/`onRedChange`/`onReset` (Content→Bar) — intentionally remapped in Task 4 Step 3; consistent across tasks. `blueTurns`/`redTurns` typed `number | "fl"` everywhere.
