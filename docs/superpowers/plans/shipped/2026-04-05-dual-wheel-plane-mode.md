# Dual Wheel Plane Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "dual wheel" rendering mode where the avatar turns 90 degrees and each hand operates on its own wheel plane extending outward from the body, eliminating all cross-body clipping.

**Architecture:** Currently every sequence is rendered with both props on a single wall plane (XY). The dual wheel mode reassigns each hand to its own wheel plane (YZ) offset laterally from body center, and rotates the avatar 90 degrees so the arms extend naturally to each side. The existing `Plane` enum, `planeAngleToWorldPosition()`, `facingAngle`, and `ElbowPoleComputer` already support WHEEL — the work is wiring a mode toggle through the pipeline and adding lateral offsets so each hand's wheel plane is on the correct side.

**Tech Stack:** Svelte 5, TypeScript, Three.js (Vector3/Quaternion), existing DI container

**Mockup:** `docs/mockups/split-plane-mode.html` — open in browser for visual reference

---

## Key Insight: What Changes per Mode

| Aspect | Wall Mode (current) | Dual Wheel Mode (new) |
|--------|--------------------|-----------------------|
| Avatar facing | 0 (toward audience) | π/2 (90° right) |
| Blue prop plane | WALL | WHEEL |
| Red prop plane | WALL | WHEEL |
| Blue position offset | none | +X (avatar's left side) |
| Red position offset | none | -X (avatar's right side) |
| Elbow poles | Already handled per-plane by ElbowPoleComputer | Same — WHEEL case already exists |

The critical detail: both hands use `Plane.WHEEL` but their world positions must be **laterally offset** so one wheel is to the avatar's left and the other to the avatar's right. Without the offset, both hands would spin on the same centered wheel plane and still clip.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/shared/3d/domain/enums/PlaneMode.ts` | CREATE | New enum: `WALL`, `DUAL_WHEEL` (future: `FLOOR`) |
| `src/lib/shared/3d/domain/constants/plane-mode-configs.ts` | CREATE | Per-mode config: facingAngle, per-hand plane, per-hand lateral offset |
| `src/lib/shared/3d/state/avatar-instance-state.svelte.ts` | MODIFY | Add `planeMode` state, pass to `loadSequence`, apply lateral offsets |
| `src/lib/shared/3d/services/implementations/SequenceConverter.ts` | MODIFY | Accept per-hand plane overrides |
| `src/lib/shared/3d/services/contracts/ISequenceConverter.ts` | MODIFY | Update interface signature |
| `src/lib/shared/3d/domain/models/MotionData3D.ts` | MODIFY | Add optional `lateralOffset` to MotionConfig3D |
| `src/lib/shared/3d/services/implementations/PropStateInterpolator.ts` | MODIFY | Apply lateralOffset to worldPosition |
| `src/lib/shared/3d/components/panels/SceneOverlayControls.svelte` | MODIFY | Add plane mode toggle button |
| `src/lib/shared/3d/components/controls/PlaneModeToggle.svelte` | CREATE | Toggle button component |
| `src/lib/shared/3d/Viewer3DModule.svelte` | MODIFY | Thread planeMode through to avatar instance |
| `tests/unit/3d/plane-mode-offsets.test.ts` | CREATE | Verify lateral offset math |

---

## Task 1: PlaneMode Enum and Config

**Files:**
- Create: `src/lib/shared/3d/domain/enums/PlaneMode.ts`
- Create: `src/lib/shared/3d/domain/constants/plane-mode-configs.ts`
- Test: `tests/unit/3d/plane-mode-offsets.test.ts`

- [ ] **Step 1: Create PlaneMode enum**

```typescript
// src/lib/shared/3d/domain/enums/PlaneMode.ts
/**
 * PlaneMode - How the avatar orients relative to the audience
 * and which planes each hand operates on.
 *
 * WALL: Both hands on XY plane, avatar faces audience.
 * DUAL_WHEEL: Each hand on its own YZ wheel plane offset laterally,
 *             avatar turned 90 degrees so arms extend to each side.
 */
export enum PlaneMode {
  WALL = "wall",
  DUAL_WHEEL = "dual-wheel",
}
```

- [ ] **Step 2: Create plane mode config**

```typescript
// src/lib/shared/3d/domain/constants/plane-mode-configs.ts
import { Plane } from "../enums/Plane";
import { PlaneMode } from "../enums/PlaneMode";

/**
 * How far each hand's wheel plane is offset from body center.
 * Roughly half shoulder width — enough to clear the torso.
 */
const LATERAL_OFFSET = 0.18;

export interface PlaneModeConfig {
  /** Avatar's Y-axis rotation in radians */
  facingAngle: number;
  /** Which plane the blue (left) hand operates on */
  bluePlane: Plane;
  /** Which plane the red (right) hand operates on */
  redPlane: Plane;
  /** X-axis offset for blue hand's plane center (in avatar-local space) */
  blueLateralOffset: number;
  /** X-axis offset for red hand's plane center (in avatar-local space) */
  redLateralOffset: number;
}

export const PLANE_MODE_CONFIGS: Record<PlaneMode, PlaneModeConfig> = {
  [PlaneMode.WALL]: {
    facingAngle: 0,
    bluePlane: Plane.WALL,
    redPlane: Plane.WALL,
    blueLateralOffset: 0,
    redLateralOffset: 0,
  },
  [PlaneMode.DUAL_WHEEL]: {
    // Avatar faces +X (stage right). From the audience, they see
    // the performer's side profile.
    facingAngle: Math.PI / 2,
    bluePlane: Plane.WHEEL,
    redPlane: Plane.WHEEL,
    // Blue = left hand = extends toward +X (audience-left in side profile)
    blueLateralOffset: LATERAL_OFFSET,
    // Red = right hand = extends toward -X (audience-right in side profile)
    redLateralOffset: -LATERAL_OFFSET,
  },
};
```

- [ ] **Step 3: Write tests for offset correctness**

```typescript
// tests/unit/3d/plane-mode-offsets.test.ts
import { describe, it, expect } from "vitest";
import { PLANE_MODE_CONFIGS } from "$lib/shared/3d/domain/constants/plane-mode-configs";
import { PlaneMode } from "$lib/shared/3d/domain/enums/PlaneMode";
import { Plane } from "$lib/shared/3d/domain/enums/Plane";

describe("PlaneModeConfigs", () => {
  it("wall mode uses WALL plane for both hands with zero offset", () => {
    const config = PLANE_MODE_CONFIGS[PlaneMode.WALL];
    expect(config.bluePlane).toBe(Plane.WALL);
    expect(config.redPlane).toBe(Plane.WALL);
    expect(config.blueLateralOffset).toBe(0);
    expect(config.redLateralOffset).toBe(0);
    expect(config.facingAngle).toBe(0);
  });

  it("dual wheel mode uses WHEEL plane with opposing lateral offsets", () => {
    const config = PLANE_MODE_CONFIGS[PlaneMode.DUAL_WHEEL];
    expect(config.bluePlane).toBe(Plane.WHEEL);
    expect(config.redPlane).toBe(Plane.WHEEL);
    // Blue offset is positive (avatar's left), red is negative (avatar's right)
    expect(config.blueLateralOffset).toBeGreaterThan(0);
    expect(config.redLateralOffset).toBeLessThan(0);
    // They're symmetric
    expect(config.blueLateralOffset).toBe(-config.redLateralOffset);
    // Avatar turns 90 degrees
    expect(config.facingAngle).toBeCloseTo(Math.PI / 2);
  });
});
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/unit/3d/plane-mode-offsets.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```
feat(3d): add PlaneMode enum and dual-wheel configuration
```

---

## Task 2: Add lateralOffset to MotionConfig3D and PropStateInterpolator

**Files:**
- Modify: `src/lib/shared/3d/domain/models/MotionData3D.ts`
- Modify: `src/lib/shared/3d/services/implementations/PropStateInterpolator.ts`
- Test: `tests/unit/3d/plane-mode-offsets.test.ts` (extend)

- [ ] **Step 1: Add lateralOffset field to MotionConfig3D**

In `src/lib/shared/3d/domain/models/MotionData3D.ts`, add to the `MotionConfig3D` interface:

```typescript
  /**
   * X-axis offset for this hand's plane center, in avatar-local space.
   * Used in dual-wheel mode to separate each hand's wheel plane laterally.
   * Default: 0 (no offset, planes centered on body).
   */
  lateralOffset?: number;
```

- [ ] **Step 2: Apply offset in PropStateInterpolator**

In `PropStateInterpolator.calculatePropState()`, apply the lateral offset **once at the end** of the method, after both the linear and circular code paths have produced `worldPosition`. This avoids duplicating the offset logic in both branches:

```typescript
    // Apply lateral offset (used in dual-wheel mode to separate each
    // hand's wheel plane to opposite sides of the body).
    // Applied in avatar-local X because the avatar group rotation
    // (facingAngle) is applied later in prop3d-transforms.ts.
    if (config.lateralOffset) {
      result.worldPosition.x += config.lateralOffset;
    }

    return result;
```

Restructure the method so both branches produce a `result` object, then apply the offset and return. This keeps the offset logic in one place.

- [ ] **Step 3: Extend tests to verify offset applied through interpolator**

These tests call `PropStateInterpolator.calculatePropState()` end-to-end to verify the lateral offset actually shifts the world position. They need real instances of the interpolator's dependencies (AngleMathCalculator, OrientationMapper, MotionCalculator) from the DI container, or minimal stubs. Use the real classes since they're pure math:

```typescript
import { PropStateInterpolator } from "$lib/shared/3d/services/implementations/PropStateInterpolator";
import { AngleMathCalculator } from "$lib/shared/3d/services/implementations/AngleMathCalculator";
import { OrientationMapper } from "$lib/shared/3d/services/implementations/OrientationMapper";
import { MotionCalculator } from "$lib/shared/3d/services/implementations/MotionCalculator";
import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { MotionType, RotationDirection, Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

describe("lateral offset through PropStateInterpolator", () => {
  const interpolator = new PropStateInterpolator(
    new AngleMathCalculator(),
    new OrientationMapper(),
    new MotionCalculator()
  );

  const baseConfig = {
    plane: Plane.WHEEL,
    startLocation: GridLocation.NORTH,
    endLocation: GridLocation.NORTH,
    motionType: MotionType.STATIC,
    rotationDirection: RotationDirection.NO_ROTATION,
    turns: 0,
    startOrientation: Orientation.IN,
    endOrientation: Orientation.IN,
  };

  it("no offset produces X=0 on WHEEL plane", () => {
    const result = interpolator.calculatePropState(baseConfig, 0);
    expect(result.worldPosition.x).toBeCloseTo(0);
  });

  it("positive lateralOffset shifts worldPosition.x positive", () => {
    const result = interpolator.calculatePropState(
      { ...baseConfig, lateralOffset: 0.18 }, 0
    );
    expect(result.worldPosition.x).toBeCloseTo(0.18);
  });

  it("opposing offsets separate hands laterally", () => {
    const left = interpolator.calculatePropState(
      { ...baseConfig, lateralOffset: 0.18 }, 0
    );
    const right = interpolator.calculatePropState(
      { ...baseConfig, lateralOffset: -0.18 }, 0
    );
    expect(left.worldPosition.x - right.worldPosition.x).toBeCloseTo(0.36);
  });
});
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/unit/3d/plane-mode-offsets.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```
feat(3d): add lateralOffset to MotionConfig3D and apply in interpolator
```

---

## Task 3: Thread PlaneMode Through SequenceConverter

**Files:**
- Modify: `src/lib/shared/3d/services/implementations/SequenceConverter.ts`
- Modify: `src/lib/shared/3d/services/contracts/ISequenceConverter.ts`

- [ ] **Step 1: Update ISequenceConverter interface**

Add a `PlaneModeConfig` import and update signatures to accept optional per-hand config:

```typescript
import type { PlaneModeConfig } from "../../domain/constants/plane-mode-configs";

// Update existing method signatures:
sequenceToMotionConfigs(
  sequence: SequenceData,
  plane?: Plane,
  modeConfig?: PlaneModeConfig
): StepMotionConfigs[];

getStartPositionConfigs(
  sequence: SequenceData,
  plane?: Plane,
  modeConfig?: PlaneModeConfig
): StepMotionConfigs | null;
```

- [ ] **Step 2: Update SequenceConverter implementation**

When `modeConfig` is provided, use per-hand planes and lateral offsets instead of the single `plane` parameter:

```typescript
beatDataToConfigs(
  beat: StepData | StartPositionData,
  plane: Plane = Plane.WALL,
  modeConfig?: PlaneModeConfig
): StepMotionConfigs {
  const blueMotion = beat.motions?.[MotionColor.BLUE];
  const redMotion = beat.motions?.[MotionColor.RED];

  const stepNumber =
    "isStartPosition" in beat && beat.isStartPosition
      ? 0
      : (beat as StepData).stepNumber ?? 0;

  // If a mode config is provided, use per-hand planes and offsets.
  // Otherwise fall back to the single plane for both hands (current behavior).
  const bluePlane = modeConfig?.bluePlane ?? plane;
  const redPlane = modeConfig?.redPlane ?? plane;
  const blueOffset = modeConfig?.blueLateralOffset ?? 0;
  const redOffset = modeConfig?.redLateralOffset ?? 0;

  return {
    stepNumber,
    blue:
      blueMotion && blueMotion.isVisible !== false
        ? { ...this.motionDataToConfig3D(blueMotion, bluePlane), lateralOffset: blueOffset || undefined }
        : null,
    red:
      redMotion && redMotion.isVisible !== false
        ? { ...this.motionDataToConfig3D(redMotion, redPlane), lateralOffset: redOffset || undefined }
        : null,
  };
}
```

Thread `modeConfig` through `sequenceToMotionConfigs` and `getStartPositionConfigs` to `beatDataToConfigs`.

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit 2>&1 | grep -i "SequenceConverter\|ISequenceConverter" | head -10`
Expected: No errors from these files

- [ ] **Step 4: Commit**

```
feat(3d): thread PlaneModeConfig through SequenceConverter for per-hand planes
```

---

## Task 4: Wire PlaneMode Into Avatar Instance State

**Files:**
- Modify: `src/lib/shared/3d/state/avatar-instance-state.svelte.ts`

This is the key integration point. When `planeMode` changes, the sequence is re-converted with the new mode's config, and the avatar's facing angle snaps to the mode's facing angle.

- [ ] **Step 1: Add planeMode state and re-conversion logic**

In the avatar instance state factory, add:

```typescript
import { PlaneMode } from "../domain/enums/PlaneMode";
import { PLANE_MODE_CONFIGS } from "../domain/constants/plane-mode-configs";

// Inside the factory function:
let planeMode = $state<PlaneMode>(PlaneMode.WALL);

// When planeMode changes, re-convert the loaded sequence with new planes/offsets
function setPlaneMode(mode: PlaneMode) {
  planeMode = mode;
  const modeConfig = PLANE_MODE_CONFIGS[mode];

  // Update avatar facing angle to match mode
  targetFacingAngle = modeConfig.facingAngle;

  // Re-convert loaded sequence with new plane assignments
  if (loadedSequence) {
    const motionConfigs = sequenceConverter.sequenceToMotionConfigs(
      loadedSequence,
      Plane.WALL,  // base plane (overridden by modeConfig)
      modeConfig
    );
    const startConfig = sequenceConverter.getStartPositionConfigs(
      loadedSequence,
      Plane.WALL,
      modeConfig
    );
    stepConfigs = startConfig
      ? [startConfig, ...motionConfigs]
      : motionConfigs;

    updateVisibilityFromStep(stepConfigs[currentStepIndex] ?? stepConfigs[0]);
  }
}
```

- [ ] **Step 2: Also use planeMode in initial loadSequence**

Update `loadSequence` to use the current `planeMode`:

```typescript
function loadSequence(sequence: SequenceData) {
  loadedSequence = sequence;
  const modeConfig = PLANE_MODE_CONFIGS[planeMode];

  const motionConfigs = sequenceConverter.sequenceToMotionConfigs(
    sequence,
    Plane.WALL,
    modeConfig
  );
  const startConfig = sequenceConverter.getStartPositionConfigs(
    sequence,
    Plane.WALL,
    modeConfig
  );
  // ... rest unchanged
}
```

- [ ] **Step 3: Expose planeMode and setPlaneMode in the returned state**

Add to the return object:

```typescript
get planeMode() { return planeMode; },
setPlaneMode,
```

- [ ] **Step 4: Run type check**

Run: `npx tsc --noEmit 2>&1 | grep -i "avatar-instance" | head -10`
Expected: No new errors

- [ ] **Step 5: Commit**

```
feat(3d): wire PlaneMode through avatar instance state with live re-conversion
```

---

## Task 5: UI Toggle in Scene Overlay

**Files:**
- Create: `src/lib/shared/3d/components/controls/PlaneModeToggle.svelte`
- Modify: `src/lib/shared/3d/components/panels/SceneOverlayControls.svelte`
- Modify: `src/lib/shared/3d/Viewer3DModule.svelte`

- [ ] **Step 1: Create PlaneModeToggle component**

A simple two-state toggle button:

```svelte
<script lang="ts">
  import { PlaneMode } from "../../domain/enums/PlaneMode";

  interface Props {
    mode: PlaneMode;
    onModeChange: (mode: PlaneMode) => void;
  }

  let { mode, onModeChange }: Props = $props();

  function toggle() {
    const next = mode === PlaneMode.WALL ? PlaneMode.DUAL_WHEEL : PlaneMode.WALL;
    onModeChange(next);
  }
</script>

<button
  class="plane-mode-toggle"
  onclick={toggle}
  title={mode === PlaneMode.WALL ? "Switch to dual wheel mode" : "Switch to wall mode"}
>
  <span class="icon">{mode === PlaneMode.WALL ? "▯" : "⟐"}</span>
  <span class="label">{mode === PlaneMode.WALL ? "Wall" : "Dual Wheel"}</span>
</button>

<style>
  .plane-mode-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 6px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text, #fff);
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    transition: border-color 0.15s;
  }
  .plane-mode-toggle:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }
  .icon {
    font-size: 14px;
  }
</style>
```

- [ ] **Step 2: Add PlaneModeToggle to SceneOverlayControls props and layout**

Add `planeMode` and `onPlaneModeChange` to the Props interface and render the toggle in the top bar near camera presets.

- [ ] **Step 3: Thread planeMode from Viewer3DModule to SceneOverlayControls**

In `Viewer3DModule.svelte`, pass the active performer's `planeMode` and `setPlaneMode` callback through to `SceneOverlayControls`.

- [ ] **Step 4: Verify visually**

Open the 3D viewer, load a sequence, and click the toggle. Avatar should turn 90 degrees and props should render on side planes.

- [ ] **Step 5: Commit**

```
feat(3d): add plane mode toggle UI to scene overlay controls
```

---

## Task 6: Verify and Tune

- [ ] **Step 1: Test with a known cross-body sequence**

Load a sequence where both hands cross to opposite sides. Toggle between WALL and DUAL_WHEEL modes. In dual wheel mode, the arms should extend naturally to each side with no clipping.

- [ ] **Step 2: Tune lateral offset**

The `LATERAL_OFFSET` constant (0.18m) may need adjustment. If the arms still clip at the shoulders, increase it. If they look unnaturally splayed, decrease it. The sweet spot is roughly half shoulder width.

- [ ] **Step 3: Verify elbow poles work correctly in WHEEL mode**

`ElbowPoleComputer.computeWheelPole()` already handles WHEEL plane elbows — base direction is laterally outward. Verify the elbows point away from the body on both sides. The cross-body adjustments in the wall pole case shouldn't fire since hands are on their natural sides.

- [ ] **Step 4: Verify spine twist behavior in dual wheel mode**

The SpineTwister may need to be suppressed or reduced in dual wheel mode since the avatar is already turned and the hands aren't crossing. If the twist looks odd, add a check in `AvatarAnimator` to scale twist by 0 when in dual wheel mode (the hands won't be crossing anyway).

- [ ] **Step 5: Run full test suite and type check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: All pass, no new errors

- [ ] **Step 6: Commit any tuning adjustments**

```
fix(3d): tune dual wheel mode offset and elbow behavior
```

---

## What This Does NOT Cover (Future Work)

- **Floor plane mode** — same concept, third orientation. Mentioned by user as future.
- **Anti-spin path cheating** — adjusting circular paths to sneak above the shoulder during full rotations. Separate from plane mode.
- **Per-beat mode switching** — currently the mode is a global toggle for the whole sequence. Auto-detecting which beats need which mode is a future enhancement.
- **Smooth animated transition** — the avatar facing angle already lerps smoothly via `updateLocomotion`, so the turn will animate. But the prop plane change is instant. If a crossfade is wanted between wall and wheel prop positions during the turn, that's additional work.
- **Bone pose editor (Path B)** — for edge cases the algorithm can't handle, a manual joint editor. Separate plan.
