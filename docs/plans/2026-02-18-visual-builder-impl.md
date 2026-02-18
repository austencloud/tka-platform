# Visual Sequence Builder - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a click-to-build visual sequence builder where users click grid points, watch props animate along arc/line paths, and see static pictograph arrows at rest.

**Architecture:** SVG backbone using existing PictographRenderer components (GridSvg, PropSvg, ArrowSvg). Arc interpolation math extracted from PropInterpolator. Sequential per-hand path building (blue's entire path, then red's).

**Tech Stack:** Svelte 5 + TypeScript + ITI DI + existing pictograph rendering pipeline

**Design Doc:** `docs/plans/2026-02-18-visual-builder-design.md`

---

## Task 1: Rewrite State — Sequential Per-Hand Model

The current state (`visual-builder-state.svelte.ts`) uses beat-interleaved logic (blue start/end, red start/end, auto-confirm). Replace it with a sequential per-hand model: build blue's entire multi-beat path, click Done, build red's entire path, Done.

**Files:**
- Rewrite: `src/lib/features/visual-builder-lab/state/visual-builder-state.svelte.ts`

**Step 1: Write the new state module**

Replace the entire file. The new state tracks:
- `phase`: `'idle' | 'placing' | 'building' | 'animating' | 'done' | 'complete'`
- `activeHand`: `MotionColor.BLUE | MotionColor.RED`
- Per-hand arrays of `BuilderBeat` (start, end, motionType, rotation, turns, orientations)
- Current position + orientation for the hand being built
- Controls: rotationDirection, turnCount

Key behavioral changes from old state:
- `handlePointClick()` only affects the active hand
- First click = placing (prop appears), subsequent clicks = motion (prop animates)
- No auto-switching between hands — user clicks "Done" explicitly
- `finishHand()` locks current hand's path, switches to other hand or completes
- `undoBeat()` removes last beat from active hand
- `reset()` clears everything

```typescript
/**
 * Visual Builder State - Sequential Per-Hand Model
 *
 * Build blue's entire multi-beat path, click Done, build red's path, Done.
 * Each click after the first creates a motion (the prop animates to the clicked point).
 * Resting state between clicks shows static pictograph with arrows.
 */

import {
  GridLocation,
  GridMode,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  MotionColor,
  Orientation,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

export type BuilderPhase = "idle" | "placing" | "building" | "animating" | "done" | "complete";

export interface BuilderBeat {
  readonly startPosition: GridLocation;
  readonly endPosition: GridLocation;
  readonly rotationDirection: RotationDirection;
  readonly turnCount: number;
  readonly startOrientation: Orientation;
  readonly endOrientation: Orientation;
}

export function createVisualBuilderState() {
  // Phase & hand
  let phase = $state<BuilderPhase>("idle");
  let activeHand = $state<MotionColor>(MotionColor.BLUE);
  let gridMode = $state<GridMode>(GridMode.DIAMOND);

  // Per-hand completed beats
  let blueBeats = $state<BuilderBeat[]>([]);
  let redBeats = $state<BuilderBeat[]>([]);

  // Current position of the active hand's prop (where it sits right now)
  let currentPosition = $state<GridLocation | null>(null);
  let currentOrientation = $state<Orientation>(Orientation.IN);

  // Controls (set BEFORE clicking the next point)
  let rotationDirection = $state<RotationDirection>(RotationDirection.CLOCKWISE);
  let turnCount = $state<number>(0);

  // Animation callback — set by the component to trigger SvgPropAnimator
  let onAnimationRequest = $state<
    ((beat: BuilderBeat) => Promise<void>) | null
  >(null);

  // Derived
  const activeBeats = $derived(activeHand === MotionColor.BLUE ? blueBeats : redBeats);
  const beatCount = $derived(blueBeats.length + redBeats.length);
  const isBlueComplete = $derived(phase === "done" || phase === "complete"
    ? true
    : activeHand === MotionColor.RED);
  const canUndo = $derived(
    phase === "building" && activeBeats.length > 0
    || phase === "placing"
  );
  const canFinishHand = $derived(
    phase === "building" && activeBeats.length > 0
  );

  /** First click — place prop at a grid point */
  function placeFirstPoint(location: GridLocation): void {
    currentPosition = location;
    currentOrientation = Orientation.IN;
    phase = "placing";
  }

  /** Subsequent clicks — create a motion from currentPosition to the clicked point */
  async function addMotion(endLocation: GridLocation): Promise<void> {
    if (currentPosition === null) return;

    // Calculate end orientation from turns and start orientation
    const endOri = calculateEndOrientation(
      currentOrientation, turnCount
    );

    const beat: BuilderBeat = {
      startPosition: currentPosition,
      endPosition: endLocation,
      rotationDirection,
      turnCount,
      startOrientation: currentOrientation,
      endOrientation: endOri,
    };

    // Trigger animation
    phase = "animating";
    if (onAnimationRequest) {
      await onAnimationRequest(beat);
    }

    // Add beat to active hand
    if (activeHand === MotionColor.BLUE) {
      blueBeats = [...blueBeats, beat];
    } else {
      redBeats = [...redBeats, beat];
    }

    // Advance: end position becomes new current position
    currentPosition = endLocation;
    currentOrientation = endOri;
    phase = "building";
  }

  /** Main click handler — routes to placeFirstPoint or addMotion */
  function handlePointClick(location: GridLocation): void {
    if (phase === "animating") return; // ignore during animation

    if (phase === "idle" || phase === "placing") {
      if (currentPosition === null) {
        placeFirstPoint(location);
      } else {
        addMotion(location);
      }
      return;
    }

    if (phase === "building") {
      addMotion(location);
      return;
    }
  }

  /** Finish current hand's path, switch to other hand or complete */
  function finishHand(): void {
    if (activeHand === MotionColor.BLUE) {
      // Switch to red
      activeHand = MotionColor.RED;
      currentPosition = null;
      currentOrientation = Orientation.IN;
      phase = "idle";
    } else {
      // Both hands done
      phase = "complete";
    }
  }

  /** Undo last beat from active hand */
  function undoBeat(): void {
    if (phase === "placing" && currentPosition !== null) {
      // Undo the initial placement
      currentPosition = null;
      phase = "idle";
      return;
    }

    const beats = activeHand === MotionColor.BLUE ? blueBeats : redBeats;
    if (beats.length === 0) return;

    const lastBeat = beats[beats.length - 1]!;

    if (activeHand === MotionColor.BLUE) {
      blueBeats = blueBeats.slice(0, -1);
    } else {
      redBeats = redBeats.slice(0, -1);
    }

    // Restore position to the start of the removed beat
    currentPosition = lastBeat.startPosition;
    currentOrientation = lastBeat.startOrientation;
    phase = blueBeats.length > 0 || redBeats.length > 0 ? "building" : "placing";
  }

  /** Full reset */
  function reset(): void {
    phase = "idle";
    activeHand = MotionColor.BLUE;
    blueBeats = [];
    redBeats = [];
    currentPosition = null;
    currentOrientation = Orientation.IN;
    rotationDirection = RotationDirection.CLOCKWISE;
    turnCount = 0;
  }

  function setRotationDirection(dir: RotationDirection): void {
    rotationDirection = dir;
  }

  function setTurnCount(turns: number): void {
    turnCount = turns;
  }

  function setOrientation(ori: Orientation): void {
    currentOrientation = ori;
  }

  function setAnimationCallback(cb: (beat: BuilderBeat) => Promise<void>): void {
    onAnimationRequest = cb;
  }

  return {
    // Readable state
    get phase() { return phase; },
    get activeHand() { return activeHand; },
    get gridMode() { return gridMode; },
    get blueBeats() { return blueBeats; },
    get redBeats() { return redBeats; },
    get currentPosition() { return currentPosition; },
    get currentOrientation() { return currentOrientation; },
    get rotationDirection() { return rotationDirection; },
    get turnCount() { return turnCount; },
    get activeBeats() { return activeBeats; },
    get beatCount() { return beatCount; },
    get isBlueComplete() { return isBlueComplete; },
    get canUndo() { return canUndo; },
    get canFinishHand() { return canFinishHand; },

    // Actions
    handlePointClick,
    finishHand,
    undoBeat,
    reset,
    setRotationDirection,
    setTurnCount,
    setOrientation,
    setAnimationCallback,
  };
}

/**
 * Calculate end orientation based on start orientation and turn count.
 * Even turns preserve, odd turns reverse (for pro/static).
 * At 0 turns, orientation stays the same.
 */
function calculateEndOrientation(
  startOrientation: Orientation,
  turns: number,
): Orientation {
  if (turns === 0) return startOrientation;

  // Each full turn (1 turn = 180deg) flips orientation
  const isOddHalfTurns = Math.round(turns * 2) % 2 !== 0;
  if (!isOddHalfTurns) return startOrientation;

  // Reverse: in<->out, clock<->counter
  switch (startOrientation) {
    case Orientation.IN: return Orientation.OUT;
    case Orientation.OUT: return Orientation.IN;
    case Orientation.CLOCK: return Orientation.COUNTER;
    case Orientation.COUNTER: return Orientation.CLOCK;
    default: return startOrientation;
  }
}

export type VisualBuilderState = ReturnType<typeof createVisualBuilderState>;
```

**Step 2: Verify TypeScript compiles**

Run: `set +o onecmd; npx svelte-check --workspace src/lib/features/visual-builder-lab/`
Expected: 0 errors in the state file (other files will break temporarily — that's fine, they'll be updated in later tasks)

**Step 3: Commit**

```bash
git add src/lib/features/visual-builder-lab/state/visual-builder-state.svelte.ts
git commit -m "refactor(visual-builder): rewrite state to sequential per-hand model"
```

---

## Task 2: SvgPropAnimator Service — Arc Math + RAF Driver

Extract the interpolation math from `PropInterpolator` + `AngleCalculator` + `EndpointCalculator` into a standalone service that drives SVG element transforms via requestAnimationFrame.

**Files:**
- Create: `src/lib/features/visual-builder-lab/services/contracts/ISvgPropAnimator.ts`
- Create: `src/lib/features/visual-builder-lab/services/implementations/SvgPropAnimator.ts`

**Reference files (read, don't modify):**
- `src/lib/features/compose/services/implementations/AngleCalculator.ts` — `normalizeAnglePositive`, `normalizeAngleSigned`, `mapPositionToAngle`, `mapOrientationToAngle`, `lerpAngle`
- `src/lib/features/compose/shared/domain/math-constants.ts` — `PI`, `TWO_PI`, `HALF_PI`, `LOCATION_ANGLES`

**Step 1: Write the interface**

```typescript
// src/lib/features/visual-builder-lab/services/contracts/ISvgPropAnimator.ts

import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { Orientation, RotationDirection } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

export interface AnimationParams {
  /** The SVG <g> element wrapping the prop to animate */
  element: SVGGElement;
  /** Grid location where prop currently sits */
  startPosition: GridLocation;
  /** Grid location to animate toward */
  endPosition: GridLocation;
  /** CW or CCW — determines pro vs anti for shifts */
  rotationDirection: RotationDirection;
  /** Number of additional turns (0, 0.5, 1, ...) */
  turnCount: number;
  /** Prop's current orientation */
  startOrientation: Orientation;
  /** Duration in milliseconds */
  durationMs: number;
  /** Center point of the prop SVG artwork (for transform origin correction) */
  propCenter: { x: number; y: number };
}

export interface ISvgPropAnimator {
  /** Animate prop from start to end. Resolves when animation completes. */
  animate(params: AnimationParams): Promise<void>;
  /** Cancel any running animation */
  cancel(): void;
}
```

**Step 2: Write the implementation**

The core math, extracted from AngleCalculator and adapted for SVG-space output:

```typescript
// src/lib/features/visual-builder-lab/services/implementations/SvgPropAnimator.ts

import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  Orientation,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import {
  HALF_PI,
  LOCATION_ANGLES,
  PI,
  TWO_PI,
} from "$lib/features/compose/shared/domain/math-constants";
import type { AnimationParams, ISvgPropAnimator } from "../contracts/ISvgPropAnimator";

// 950x950 SVG coordinate space
const CENTER = 475;
const GRID_RADIUS = 143.1; // distance from center to hand points

/** Normalize angle to [0, 2*PI) */
function normPos(angle: number): number {
  const n = angle % TWO_PI;
  return n < 0 ? n + TWO_PI : n;
}

/** Normalize angle to (-PI, PI] — shortest signed delta */
function normSigned(angle: number): number {
  const n = normPos(angle);
  return n > PI ? n - TWO_PI : n;
}

/** Map grid location to polar angle (radians) */
function locToAngle(loc: GridLocation): number {
  return LOCATION_ANGLES[loc];
}

/** Map orientation to staff angle given a center path angle */
function oriToStaffAngle(ori: Orientation, centerAngle: number): number {
  switch (ori) {
    case Orientation.IN: return normPos(centerAngle + PI);
    case Orientation.OUT: return normPos(centerAngle);
    case Orientation.CLOCK: return normPos(centerAngle + HALF_PI);
    case Orientation.COUNTER: return normPos(centerAngle - HALF_PI);
    default: return normPos(centerAngle + PI); // default to IN
  }
}

/** Shortest-path angular interpolation */
function lerpAngle(a: number, b: number, t: number): number {
  const d = normSigned(b - a);
  return normPos(a + d * t);
}

/** Cubic ease-in-out */
function easeInOut(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Determine if motion is a dash (opposite points) vs shift (adjacent) vs static (same) */
function isOpposite(a: GridLocation, b: GridLocation): boolean {
  const angleA = locToAngle(a);
  const angleB = locToAngle(b);
  const delta = Math.abs(normSigned(angleB - angleA));
  return Math.abs(delta - PI) < 0.01;
}

export class SvgPropAnimator implements ISvgPropAnimator {
  private animationFrameId: number | null = null;
  private cancelResolve: (() => void) | null = null;

  async animate(params: AnimationParams): Promise<void> {
    this.cancel(); // cancel any running animation

    const {
      element, startPosition, endPosition,
      rotationDirection, turnCount, startOrientation,
      durationMs, propCenter,
    } = params;

    // Respect reduced motion
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = prefersReduced ? 0 : durationMs;

    // Calculate endpoints
    const startCenterAngle = locToAngle(startPosition);
    const endCenterAngle = locToAngle(endPosition);
    const startStaffAngle = oriToStaffAngle(startOrientation, startCenterAngle);

    const isSamePoint = startPosition === endPosition;
    const isDash = !isSamePoint && isOpposite(startPosition, endPosition);

    // Calculate staff rotation delta
    // For shifts: staff moves with (pro) or against (anti) the arc
    // For dashes/static at 0 turns: no rotation
    const centerMovement = normSigned(endCenterAngle - startCenterAngle);
    const dirSign = rotationDirection === RotationDirection.COUNTER_CLOCKWISE ? -1 : 1;
    const turnRotation = dirSign * turnCount * PI; // 1 turn = 180deg

    let staffRotationDelta: number;
    if (isSamePoint) {
      // Static: just turn rotation
      staffRotationDelta = turnRotation;
    } else if (isDash) {
      // Dash: only turn rotation (no arc component)
      staffRotationDelta = turnRotation;
    } else {
      // Shift: arc component + turn rotation
      // Pro = staff moves WITH arc, Anti = staff moves AGAINST arc
      // Since the user sets CW/CCW and we derive pro/anti from hand path direction,
      // we need to check if userDir matches the arc direction
      const arcDir = centerMovement > 0 ? 1 : -1; // positive = CCW, negative = CW
      const userDir = dirSign; // +1 = CCW, -1 = CW
      const isPro = (arcDir === userDir) || (Math.abs(centerMovement) < 0.01);
      const staffArcComponent = isPro ? centerMovement : -centerMovement;
      staffRotationDelta = staffArcComponent + turnRotation;
    }

    // For dash: use Cartesian interpolation
    const startX = isDash ? Math.cos(startCenterAngle) : 0;
    const startY = isDash ? Math.sin(startCenterAngle) : 0;
    const endX = isDash ? Math.cos(endCenterAngle) : 0;
    const endY = isDash ? Math.sin(endCenterAngle) : 0;

    // Instant jump for 0 duration
    if (duration <= 0) {
      this.applyTransform(element, endCenterAngle, isDash, endX, endY,
        normPos(startStaffAngle + staffRotationDelta), propCenter);
      return;
    }

    return new Promise<void>((resolve) => {
      this.cancelResolve = resolve;
      const startTime = performance.now();

      const tick = (now: number) => {
        const elapsed = now - startTime;
        const rawProgress = Math.min(elapsed / duration, 1);
        const t = easeInOut(rawProgress);

        // Interpolate center position
        let displayAngle: number;
        let cartX = 0;
        let cartY = 0;

        if (isDash) {
          // Cartesian lerp (straight line through center)
          cartX = startX + (endX - startX) * t;
          cartY = startY + (endY - startY) * t;
          displayAngle = Math.atan2(cartY, cartX);
        } else if (isSamePoint) {
          displayAngle = startCenterAngle;
        } else {
          // Angular lerp (arc path)
          displayAngle = lerpAngle(startCenterAngle, endCenterAngle, t);
        }

        // Interpolate staff rotation
        const staffAngle = normPos(startStaffAngle + staffRotationDelta * t);

        this.applyTransform(element, displayAngle, isDash, cartX, cartY,
          staffAngle, propCenter);

        if (rawProgress < 1) {
          this.animationFrameId = requestAnimationFrame(tick);
        } else {
          this.animationFrameId = null;
          this.cancelResolve = null;
          resolve();
        }
      };

      this.animationFrameId = requestAnimationFrame(tick);
    });
  }

  cancel(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.cancelResolve) {
      this.cancelResolve();
      this.cancelResolve = null;
    }
  }

  /** Apply transform to SVG element in 950x950 space */
  private applyTransform(
    element: SVGGElement,
    centerAngle: number,
    isDash: boolean,
    cartX: number,
    cartY: number,
    staffAngle: number,
    propCenter: { x: number; y: number },
  ): void {
    let x: number;
    let y: number;

    if (isDash) {
      x = CENTER + cartX * GRID_RADIUS;
      y = CENTER + cartY * GRID_RADIUS;
    } else {
      x = CENTER + Math.cos(centerAngle) * GRID_RADIUS;
      y = CENTER + Math.sin(centerAngle) * GRID_RADIUS;
    }

    // Convert staff angle from radians to degrees for SVG transform
    const rotDeg = (staffAngle * 180) / PI;

    element.style.transform =
      `translate(${x}px, ${y}px) rotate(${rotDeg}deg) translate(${-propCenter.x}px, ${-propCenter.y}px)`;
  }
}
```

**Step 3: Register in DI container**

Modify: `src/lib/shared/di/containers/visual-builder-container.ts`

Add import and registration for SvgPropAnimator:

```typescript
import { SvgPropAnimator } from "$lib/features/visual-builder-lab/services/implementations/SvgPropAnimator";

export const visualBuilderContainer = createContainer().add({
  gridHitTargetCalculator: () => new GridHitTargetCalculator(),
  beatMotionDeriver: () => new BeatMotionDeriver(),
  svgPropAnimator: () => new SvgPropAnimator(),
});
```

**Step 4: Verify TypeScript compiles**

Run: `set +o onecmd; npx svelte-check --workspace src/lib/features/visual-builder-lab/`
Expected: 0 errors in the new service files

**Step 5: Commit**

```bash
git add src/lib/features/visual-builder-lab/services/contracts/ISvgPropAnimator.ts \
        src/lib/features/visual-builder-lab/services/implementations/SvgPropAnimator.ts \
        src/lib/shared/di/containers/visual-builder-container.ts
git commit -m "feat(visual-builder): add SvgPropAnimator with arc interpolation math"
```

---

## Task 3: BuilderControls Component

Replace the separate HandSelector + BuildPhaseIndicator with a unified BuilderControls component that shows: hand indicator, orientation cycler, turn count selector, rotation direction toggle, and Done button.

**Files:**
- Create: `src/lib/features/visual-builder-lab/components/BuilderControls.svelte`
- Delete later (Task 6): `HandSelector.svelte`, `BuildPhaseIndicator.svelte`

**Step 1: Write the component**

```svelte
<!--
  BuilderControls.svelte - Unified controls for the visual builder

  Shows: phase indicator, hand label, orientation picker, rotation direction,
  turn count, Done button, Undo button. Compact single-row toolbar.
-->
<script lang="ts">
  import {
    MotionColor,
    Orientation,
    RotationDirection,
  } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import type { VisualBuilderState } from "../state/visual-builder-state.svelte";

  let { state }: { state: VisualBuilderState } = $props();

  const handLabel = $derived(
    state.activeHand === MotionColor.BLUE ? "Blue" : "Red"
  );

  const handColor = $derived(
    state.activeHand === MotionColor.BLUE ? "var(--prop-blue, #2e8bf0)" : "var(--prop-red, #ed1c24)"
  );

  const phaseMessage = $derived.by(() => {
    switch (state.phase) {
      case "idle": return `Click to place ${handLabel.toLowerCase()} prop`;
      case "placing": return `Click destination for ${handLabel.toLowerCase()}`;
      case "building": return `Click next point or Done`;
      case "animating": return "Animating...";
      case "done": return `${handLabel} path locked`;
      case "complete": return "Sequence complete";
    }
  });

  const ORIENTATIONS = [
    { value: Orientation.IN, label: "In" },
    { value: Orientation.OUT, label: "Out" },
    { value: Orientation.CLOCK, label: "CW" },
    { value: Orientation.COUNTER, label: "CCW" },
  ] as const;

  const TURN_OPTIONS = [0, 0.5, 1, 1.5, 2, 2.5, 3] as const;

  function toggleRotation(): void {
    const next = state.rotationDirection === RotationDirection.CLOCKWISE
      ? RotationDirection.COUNTER_CLOCKWISE
      : RotationDirection.CLOCKWISE;
    state.setRotationDirection(next);
  }
</script>

<div class="builder-controls">
  <!-- Phase indicator with hand color -->
  <div class="phase-badge" style="--hand-color: {handColor}">
    <span class="hand-dot" style="background: {handColor}"></span>
    <span class="phase-text">{phaseMessage}</span>
  </div>

  <!-- Controls row — only shown when actively building -->
  {#if state.phase === "placing" || state.phase === "building"}
    <div class="controls-row">
      <!-- Orientation (only on first placement) -->
      {#if state.phase === "placing"}
        <div class="control-group">
          <span class="control-label">Ori</span>
          <div class="pill-group" role="radiogroup" aria-label="Starting orientation">
            {#each ORIENTATIONS as ori}
              <button
                class="pill"
                class:active={state.currentOrientation === ori.value}
                role="radio"
                aria-checked={state.currentOrientation === ori.value}
                onclick={() => state.setOrientation(ori.value)}
              >
                {ori.label}
              </button>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Rotation direction -->
      <button
        class="icon-btn"
        onclick={toggleRotation}
        aria-label="Rotation: {state.rotationDirection === RotationDirection.CLOCKWISE ? 'Clockwise' : 'Counter-clockwise'}"
      >
        <i
          class="fas fa-rotate-right"
          class:flipped={state.rotationDirection === RotationDirection.COUNTER_CLOCKWISE}
        ></i>
        <span>{state.rotationDirection === RotationDirection.CLOCKWISE ? "CW" : "CCW"}</span>
      </button>

      <!-- Turn count -->
      <div class="control-group">
        <span class="control-label">Turns</span>
        <select
          class="turn-select"
          value={state.turnCount}
          onchange={(e) => state.setTurnCount(Number((e.target as HTMLSelectElement).value))}
          aria-label="Turn count"
        >
          {#each TURN_OPTIONS as t}
            <option value={t}>{t}</option>
          {/each}
        </select>
      </div>
    </div>
  {/if}

  <!-- Action buttons -->
  <div class="actions">
    {#if state.canUndo}
      <button class="action-btn" onclick={() => state.undoBeat()} aria-label="Undo last beat">
        <i class="fas fa-undo"></i> Undo
      </button>
    {/if}

    {#if state.canFinishHand}
      <button
        class="done-btn"
        style="--hand-color: {handColor}"
        onclick={() => state.finishHand()}
        aria-label="Done with {handLabel.toLowerCase()} hand"
      >
        Done with {handLabel}
      </button>
    {/if}

    {#if state.beatCount > 0 && state.phase !== "complete"}
      <button class="action-btn danger" onclick={() => state.reset()} aria-label="Reset all">
        <i class="fas fa-trash-alt"></i>
      </button>
    {/if}
  </div>
</div>

<style>
  .builder-controls {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    justify-content: center;
    width: 100%;
    max-width: 700px;
  }

  .phase-badge {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    min-height: 36px;
  }

  .hand-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .phase-text {
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text, #fff);
    font-weight: 500;
    white-space: nowrap;
  }

  .controls-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .control-group {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .control-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-weight: 500;
  }

  .pill-group {
    display: flex;
    gap: 2px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 6px;
    padding: 2px;
  }

  .pill {
    padding: 4px 8px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    min-height: 28px;
    transition: background 0.15s ease, color 0.15s ease;
  }

  .pill:hover {
    background: rgba(255, 255, 255, 0.06);
  }

  .pill.active {
    background: rgba(255, 255, 255, 0.1);
    color: var(--theme-text, #fff);
  }

  .icon-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 6px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, #fff);
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    min-height: 28px;
    transition: border-color 0.15s ease;
  }

  .icon-btn:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .icon-btn i.flipped {
    transform: scaleX(-1);
  }

  .turn-select {
    padding: 4px 6px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 6px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, #fff);
    font-size: var(--font-size-compact, 12px);
    min-height: 28px;
    cursor: pointer;
  }

  .actions {
    display: flex;
    gap: 6px;
    margin-left: auto;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 6px;
    background: transparent;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    min-height: 32px;
    transition: color 0.15s ease, border-color 0.15s ease;
  }

  .action-btn:hover {
    color: var(--theme-text, #fff);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .action-btn.danger:hover {
    color: var(--semantic-error, #ef4444);
    border-color: var(--semantic-error, #ef4444);
  }

  .done-btn {
    padding: 6px 16px;
    border: 1.5px solid var(--hand-color);
    border-radius: 8px;
    background: color-mix(in srgb, var(--hand-color) 15%, transparent);
    color: var(--theme-text, #fff);
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    min-height: 36px;
    transition: background 0.15s ease;
  }

  .done-btn:hover {
    background: color-mix(in srgb, var(--hand-color) 25%, transparent);
  }

  @media (prefers-reduced-motion: reduce) {
    .icon-btn i { transition: none; }
    .pill { transition: none; }
  }
</style>
```

**Step 2: Commit**

```bash
git add src/lib/features/visual-builder-lab/components/BuilderControls.svelte
git commit -m "feat(visual-builder): add BuilderControls component with orientation, turns, rotation, done"
```

---

## Task 4: Rewrite InteractiveGrid — PropSvg + ArrowSvg + Animation

The big integration task. Replace the current circle-based prop indicators and line-based motion arrows with actual `PropSvg` and `ArrowSvg` components. Wire up `SvgPropAnimator` for click-to-animate.

**Files:**
- Rewrite: `src/lib/features/visual-builder-lab/components/InteractiveGrid.svelte`

**Reference files (read, understand the props interface):**
- `src/lib/shared/pictograph/prop/components/PropSvg.svelte` — needs `motionData`, `propAssets`, `propPosition`
- `src/lib/shared/pictograph/arrow/rendering/components/ArrowSvg.svelte` — needs `motionData`, `arrowAssets`, `arrowPosition`, `shouldMirror`, `color`
- `src/lib/shared/pictograph/shared/services/implementations/PictographPreparer.ts` — use `prepareSingle()` to get all render data

**Step 1: Write the new InteractiveGrid**

This is the core of the visual builder. Key changes from current version:
- Replace `<circle class="prop-indicator">` with actual `<PropSvg>` components
- Replace `<line class="motion-line">` with actual `<ArrowSvg>` components
- Add animation wiring via `SvgPropAnimator`
- Use `PictographPreparer` to calculate arrow positions from `MotionData`
- Use `BeatMotionDeriver` to get `MotionData` from `BuilderBeat`

The component should:
1. Render GridSvg (existing, keep)
2. For each completed beat in the active hand's path, render an ArrowSvg
3. Render PropSvg for the active hand's current position
4. If blue is complete, render dimmed blue arrows + prop at final position
5. Render hit targets (existing, keep but update click handler)
6. On click → call `state.handlePointClick()` which triggers animation via callback

The animation callback is registered in the component's `$effect`:
```typescript
state.setAnimationCallback(async (beat: BuilderBeat) => {
  // Get the prop <g> element ref
  // Call svgPropAnimator.animate(...)
  // Returns when animation is done
});
```

**Important implementation notes:**
- PropSvg and ArrowSvg need `PreparedRenderData` which comes from `PictographPreparer.prepareSingle()`. This is an async call. Use `$effect` to watch state changes and re-prepare.
- For the ACTIVE prop (the one being animated), drive position via SvgPropAnimator. For COMPLETED beats' arrows and the other hand's prop, use PictographPreparer's static positions.
- The initial prop placement (first click) should use a scale-in CSS animation, not SvgPropAnimator.

This is the most complex task. Take time to read PropSvg and ArrowSvg's exact interfaces before writing.

**Step 2: Verify by running `set +o onecmd; npm run check`**

**Step 3: Commit**

```bash
git add src/lib/features/visual-builder-lab/components/InteractiveGrid.svelte
git commit -m "feat(visual-builder): integrate PropSvg, ArrowSvg, and SvgPropAnimator into grid"
```

---

## Task 5: Wire Up VisualBuilderLabModule

Update the module component to use the new state, new controls, and wire everything together.

**Files:**
- Rewrite: `src/lib/features/visual-builder-lab/VisualBuilderLabModule.svelte`

**Step 1: Update the module**

Changes from current version:
- Replace `HandSelector` + `BuildPhaseIndicator` imports with `BuilderControls`
- The completed beats strip should show beats from both hands separately (blue section, red section), not interleaved
- Add a summary section when phase is "complete" showing total beat count

```svelte
<script lang="ts">
  import { createVisualBuilderState } from "./state/visual-builder-state.svelte";
  import InteractiveGrid from "./components/InteractiveGrid.svelte";
  import BuilderControls from "./components/BuilderControls.svelte";

  const state = createVisualBuilderState();
</script>

<div class="visual-builder">
  <div class="toolbar">
    <BuilderControls {state} />
  </div>

  <div class="grid-container">
    <InteractiveGrid {state} />
  </div>

  <!-- Beat count indicators -->
  {#if state.blueBeats.length > 0 || state.redBeats.length > 0}
    <div class="beats-summary">
      {#if state.blueBeats.length > 0}
        <span class="beat-count blue">
          Blue: {state.blueBeats.length} beat{state.blueBeats.length !== 1 ? "s" : ""}
        </span>
      {/if}
      {#if state.redBeats.length > 0}
        <span class="beat-count red">
          Red: {state.redBeats.length} beat{state.redBeats.length !== 1 ? "s" : ""}
        </span>
      {/if}
    </div>
  {/if}
</div>
```

Keep existing CSS from the current version (`.visual-builder`, `.toolbar`, `.grid-container`), just update the beats section styling.

**Step 2: Verify by running `set +o onecmd; npm run check`**

**Step 3: Commit**

```bash
git add src/lib/features/visual-builder-lab/VisualBuilderLabModule.svelte
git commit -m "feat(visual-builder): wire module with new controls and sequential state"
```

---

## Task 6: Cleanup Old Components

Remove the old components that were replaced.

**Files:**
- Delete: `src/lib/features/visual-builder-lab/components/HandSelector.svelte`
- Delete: `src/lib/features/visual-builder-lab/components/BuildPhaseIndicator.svelte`

**Step 1: Verify no other files import them**

Search for imports of HandSelector and BuildPhaseIndicator across the codebase. They should only be imported by the old VisualBuilderLabModule which was replaced in Task 5.

**Step 2: Delete files**

```bash
rm src/lib/features/visual-builder-lab/components/HandSelector.svelte
rm src/lib/features/visual-builder-lab/components/BuildPhaseIndicator.svelte
```

**Step 3: Verify build succeeds**

Run: `set +o onecmd; npm run check`
Expected: 0 errors related to visual-builder-lab

**Step 4: Commit**

```bash
git add -A src/lib/features/visual-builder-lab/components/
git commit -m "chore(visual-builder): remove replaced HandSelector and BuildPhaseIndicator"
```

---

## Task 7: Full Integration Verification

End-to-end verification that the visual builder works correctly.

**Step 1: TypeScript check**

Run: `set +o onecmd; npm run check`
Expected: 0 errors related to visual-builder-lab files

**Step 2: Build check**

Run: `set +o onecmd; npm run build`
Expected: Build succeeds

**Step 3: Manual testing checklist**

Ask the user to verify in the browser:

1. Navigate to Lab > Visual Builder
2. **Blue placement:** Click a diamond grid point → blue prop appears at that position
3. **Orientation control:** Change orientation before clicking → prop rotates accordingly
4. **Blue motion:** Click another grid point → prop animates along arc (shift) or line (dash) to new position → arrow appears showing the motion
5. **Multiple beats:** Click more points → each motion adds an arrow, prop chains to new position
6. **Done button:** Click "Done with Blue" → blue arrows stay visible (dimmed), switches to red
7. **Red phase:** Same flow for red hand
8. **Complete:** After red Done → both hands' arrows visible, "Sequence complete" message
9. **Undo:** While building, click Undo → removes last beat, prop returns to previous position
10. **Reset:** Click trash → everything clears

**Step 4: Final commit if any fixes were needed**

---

## Implementation Order Summary

| Task | What | Dependencies |
|------|------|-------------|
| 1 | State rewrite (sequential per-hand) | None |
| 2 | SvgPropAnimator (arc math + RAF) | None |
| 3 | BuilderControls (UI) | Task 1 (state interface) |
| 4 | InteractiveGrid rewrite (PropSvg + ArrowSvg + animation) | Tasks 1, 2 |
| 5 | VisualBuilderLabModule rewire | Tasks 1, 3, 4 |
| 6 | Cleanup old components | Task 5 |
| 7 | Full verification | All |

Tasks 1 and 2 can be done in parallel. Task 3 can start after Task 1. Task 4 needs both 1 and 2. The rest is sequential.
