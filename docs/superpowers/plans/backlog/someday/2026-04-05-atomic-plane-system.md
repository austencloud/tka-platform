# Atomic Plane System (L8) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable per-hand per-beat plane assignment (Wall/Wheel/Floor) in the 3D viewer, with the data model supporting all 9 planes (3 primaries + 6 fusions) for L9 readiness.

**Architecture:** The existing dual-wheel infrastructure (`PlaneMode`, `PlaneModeConfig`, `SequenceConverter` with `modeConfig`) provides the per-hand plane pipeline. This plan extends it: (1) add 6 fusion plane entries to the Plane enum and plane-transforms for L9 readiness, (2) add `plane` field to MotionData for per-beat persistence, (3) replace the binary Wall/Dual-Wheel toggle with per-hand plane selectors in the 3D viewer, (4) auto-show the active plane's grid when a hand is assigned to a non-wall plane.

**Tech Stack:** Svelte 5, TypeScript, Three.js (Vector3/Quaternion), ITI DI container, existing plane-transforms.ts math

**Spec:** `docs/superpowers/specs/2026-04-05-atomic-plane-system-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/shared/3d/domain/enums/Plane.ts` | MODIFY | Add 6 fusion enum entries + labels + colors |
| `src/lib/shared/3d/domain/constants/plane-transforms.ts` | MODIFY | Add normals, up/right vectors, and position mapping for all 9 planes |
| `src/lib/shared/pictograph/shared/domain/models/MotionData.ts` | MODIFY | Add optional `plane` field to interface and factory |
| `src/lib/shared/3d/services/implementations/SequenceConverter.ts` | MODIFY | Read `motion.plane` with PlaneModeConfig precedence |
| `src/lib/shared/3d/domain/enums/PlaneMode.ts` | MODIFY | Add `CUSTOM` mode for independent per-hand planes |
| `src/lib/shared/3d/domain/constants/plane-mode-configs.ts` | MODIFY | Add CUSTOM mode config |
| `src/lib/shared/3d/components/controls/PlaneModeToggle.svelte` | REWRITE | Replace binary toggle with per-hand plane selectors |
| `src/lib/shared/3d/state/avatar-instance-state.svelte.ts` | MODIFY | Add per-hand plane state, wire to SequenceConverter |
| `src/lib/shared/3d/state/viewer-3d-state.svelte.ts` | MODIFY | Auto-show plane grid when hand assigned to non-wall plane |
| `tests/unit/3d/plane-normals.test.ts` | CREATE | Verify all 9 normals and gate geometry |
| `tests/unit/3d/sequence-converter-plane.test.ts` | CREATE | Verify plane passthrough and precedence |

---

## Task 1: Extend Plane Enum with 6 Fusion Entries

**Files:**
- Modify: `src/lib/shared/3d/domain/enums/Plane.ts`
- Create: `tests/unit/3d/plane-normals.test.ts`

- [ ] **Step 1: Add fusion entries to Plane enum**

In `src/lib/shared/3d/domain/enums/Plane.ts`, add after the `FLOOR` entry:

```typescript
export enum Plane {
  /** XY plane - performer facing audience (current 2D system) */
  WALL = "wall",
  /** YZ plane - perpendicular to wall (side view / cartwheel plane) */
  WHEEL = "wheel",
  /** XZ plane - horizontal (top-down view) */
  FLOOR = "floor",

  // ── Fusion planes (L9 — data model only, no UI at L8) ──

  /** 45° between Wall and Wheel, tilted right */
  RIGHT_SHIELD = "right-shield",
  /** 45° between Wall and Wheel, tilted left */
  LEFT_SHIELD = "left-shield",
  /** 45° between Wall and Floor, top toward audience */
  FORWARD_RAMP = "forward-ramp",
  /** 45° between Wall and Floor, top away from audience */
  BACKWARD_RAMP = "backward-ramp",
  /** 45° between Wheel and Floor, tilted right */
  RIGHT_WING = "right-wing",
  /** 45° between Wheel and Floor, tilted left */
  LEFT_WING = "left-wing",
}
```

Add labels and colors for all 9:

```typescript
export const PLANE_LABELS: Record<Plane, string> = {
  [Plane.WALL]: "Wall Plane",
  [Plane.WHEEL]: "Wheel Plane",
  [Plane.FLOOR]: "Floor Plane",
  [Plane.RIGHT_SHIELD]: "Right Shield",
  [Plane.LEFT_SHIELD]: "Left Shield",
  [Plane.FORWARD_RAMP]: "Forward Ramp",
  [Plane.BACKWARD_RAMP]: "Backward Ramp",
  [Plane.RIGHT_WING]: "Right Wing",
  [Plane.LEFT_WING]: "Left Wing",
};

export const PLANE_COLORS: Record<Plane, string> = {
  [Plane.WALL]: "#8b5cf6",       // Purple
  [Plane.WHEEL]: "#3b82f6",      // Blue
  [Plane.FLOOR]: "#22c55e",      // Green
  [Plane.RIGHT_SHIELD]: "#c084fc", // Light purple
  [Plane.LEFT_SHIELD]: "#818cf8",  // Indigo
  [Plane.FORWARD_RAMP]: "#86efac", // Light green
  [Plane.BACKWARD_RAMP]: "#6ee7b7", // Emerald
  [Plane.RIGHT_WING]: "#5eead4", // Teal
  [Plane.LEFT_WING]: "#2dd4bf",  // Cyan-teal
};
```

Also add a helper set for L8 UI filtering:

```typescript
/** Primary planes available at L8 */
export const PRIMARY_PLANES: ReadonlySet<Plane> = new Set([
  Plane.WALL, Plane.WHEEL, Plane.FLOOR,
]);
```

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit 2>&1 | head -20`

Expected: Type errors in `plane-transforms.ts` (switch statements don't handle new cases) and `plane-mode-configs.ts` (`GRID_OFFSETS` and `PLANE_MODE_CONFIGS` are missing new entries). These are expected and will be fixed in subsequent tasks.

- [ ] **Step 3: Write plane normal tests**

Create `tests/unit/3d/plane-normals.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { Vector3 } from "three";
import { Plane } from "$lib/shared/3d/domain/enums/Plane";
import { getPlaneNormal } from "$lib/shared/3d/domain/constants/plane-transforms";

const S2 = 1 / Math.sqrt(2);

const EXPECTED_NORMALS: Record<string, [number, number, number]> = {
  [Plane.WALL]:           [0, 0, 1],
  [Plane.WHEEL]:          [1, 0, 0],
  [Plane.FLOOR]:          [0, 1, 0],
  [Plane.RIGHT_SHIELD]:   [S2, 0, S2],
  [Plane.LEFT_SHIELD]:    [-S2, 0, S2],
  [Plane.FORWARD_RAMP]:   [0, S2, -S2],
  [Plane.BACKWARD_RAMP]:  [0, S2, S2],
  [Plane.RIGHT_WING]:  [S2, S2, 0],
  [Plane.LEFT_WING]:   [-S2, S2, 0],
};

describe("Plane normals", () => {
  for (const [plane, [x, y, z]] of Object.entries(EXPECTED_NORMALS)) {
    it(`${plane} has correct unit normal`, () => {
      const normal = getPlaneNormal(plane as Plane);
      expect(normal.x).toBeCloseTo(x, 5);
      expect(normal.y).toBeCloseTo(y, 5);
      expect(normal.z).toBeCloseTo(z, 5);
      expect(normal.length()).toBeCloseTo(1, 5);
    });
  }

  it("primary planes are mutually perpendicular", () => {
    const wall = getPlaneNormal(Plane.WALL);
    const wheel = getPlaneNormal(Plane.WHEEL);
    const floor = getPlaneNormal(Plane.FLOOR);
    expect(wall.dot(wheel)).toBeCloseTo(0, 5);
    expect(wall.dot(floor)).toBeCloseTo(0, 5);
    expect(wheel.dot(floor)).toBeCloseTo(0, 5);
  });

  it("diamond gate points sit on exactly 2 primary planes", () => {
    const R = 1;
    const gatePoints = [
      { name: "Up",    pos: new Vector3(0, R, 0),  planes: [Plane.WALL, Plane.WHEEL] },
      { name: "Down",  pos: new Vector3(0, -R, 0), planes: [Plane.WALL, Plane.WHEEL] },
      { name: "StgR",  pos: new Vector3(R, 0, 0),  planes: [Plane.WALL, Plane.FLOOR] },
      { name: "StgL",  pos: new Vector3(-R, 0, 0), planes: [Plane.WALL, Plane.FLOOR] },
      { name: "Dnstg", pos: new Vector3(0, 0, R),  planes: [Plane.WHEEL, Plane.FLOOR] },
      { name: "Upstg", pos: new Vector3(0, 0, -R), planes: [Plane.WHEEL, Plane.FLOOR] },
    ];

    const primaries = [Plane.WALL, Plane.WHEEL, Plane.FLOOR];

    for (const gate of gatePoints) {
      const onPlanes = primaries.filter(p => {
        const dot = Math.abs(gate.pos.dot(getPlaneNormal(p)));
        return dot < 0.001;
      });
      expect(onPlanes).toHaveLength(2);
      expect(onPlanes).toEqual(expect.arrayContaining(gate.planes));
    }
  });
});
```

- [ ] **Step 4: Run tests (they will fail — normals not implemented yet for fusions)**

Run: `npx vitest run tests/unit/3d/plane-normals.test.ts`
Expected: Primary plane tests PASS, fusion plane tests FAIL (getPlaneNormal falls through to default for new entries)

- [ ] **Step 5: Commit enum changes**

```
feat(3d): extend Plane enum with 6 fusion plane entries for L9 readiness
```

---

## Task 2: Extend plane-transforms.ts for All 9 Planes

**Files:**
- Modify: `src/lib/shared/3d/domain/constants/plane-transforms.ts`
- Test: `tests/unit/3d/plane-normals.test.ts` (written in Task 1)

- [ ] **Step 1: Add a PLANE_NORMALS lookup and update getPlaneNormal**

In `plane-transforms.ts`, add a normals record and refactor `getPlaneNormal` to use it:

```typescript
const S2 = 1 / Math.sqrt(2);

/**
 * Normal vectors for all 9 planes.
 * Primaries are axis-aligned. Fusions are 45° bisectors.
 */
const PLANE_NORMALS: Record<Plane, Vector3> = {
  [Plane.WALL]:           new Vector3(0, 0, 1),
  [Plane.WHEEL]:          new Vector3(1, 0, 0),
  [Plane.FLOOR]:          new Vector3(0, 1, 0),
  [Plane.RIGHT_SHIELD]:   new Vector3(S2, 0, S2),
  [Plane.LEFT_SHIELD]:    new Vector3(-S2, 0, S2),
  [Plane.FORWARD_RAMP]:   new Vector3(0, S2, -S2),
  [Plane.BACKWARD_RAMP]:  new Vector3(0, S2, S2),
  [Plane.RIGHT_WING]:  new Vector3(S2, S2, 0),
  [Plane.LEFT_WING]:   new Vector3(-S2, S2, 0),
};

export function getPlaneNormal(plane: Plane): Vector3 {
  return (PLANE_NORMALS[plane] ?? PLANE_NORMALS[Plane.WALL]).clone();
}
```

- [ ] **Step 2: Add getPlaneVectors for deriving up/right from any normal**

```typescript
/**
 * Derive up and right vectors for any plane from its normal.
 * Convention: "up" is the component most aligned with world +Y.
 * For Floor-like planes (normal near +Y), use -Z as reference.
 */
function deriveUpRight(normal: Vector3): { up: Vector3; right: Vector3 } {
  const worldUp = new Vector3(0, 1, 0);
  const ref = Math.abs(normal.dot(worldUp)) > 0.9
    ? new Vector3(0, 0, -1)
    : worldUp;
  const right = new Vector3().crossVectors(ref, normal).normalize();
  const up = new Vector3().crossVectors(normal, right).normalize();
  return { up, right };
}
```

- [ ] **Step 3: Refactor getPlaneUp and getPlaneRight to use deriveUpRight for fusion planes**

Keep the existing hardcoded values for primaries (they're validated and handle sign conventions correctly). For fusion planes, compute from the normal:

```typescript
export function getPlaneUp(plane: Plane): Vector3 {
  switch (plane) {
    case Plane.WALL:  return new Vector3(0, 1, 0);
    case Plane.WHEEL: return new Vector3(0, 1, 0);
    case Plane.FLOOR: return new Vector3(0, 0, -1);
    default: return deriveUpRight(PLANE_NORMALS[plane]).up.clone();
  }
}

export function getPlaneRight(plane: Plane): Vector3 {
  switch (plane) {
    case Plane.WALL:  return new Vector3(1, 0, 0);
    case Plane.WHEEL: return new Vector3(0, 0, -1);
    case Plane.FLOOR: return new Vector3(1, 0, 0);
    default: return deriveUpRight(PLANE_NORMALS[plane]).right.clone();
  }
}
```

- [ ] **Step 4: Extend planeAngleToWorldPosition for fusion planes**

Add a generic case using the normal-derived up/right vectors:

```typescript
export function planeAngleToWorldPosition(
  plane: Plane,
  angle: number,
  radius: number = GRID_RADIUS_3D
): Vector3 {
  const cos_a = Math.cos(angle);
  const sin_a = Math.sin(angle);

  switch (plane) {
    case Plane.WALL:
      return new Vector3(-cos_a * radius, -sin_a * radius, 0);
    case Plane.WHEEL:
      return new Vector3(0, -sin_a * radius, -cos_a * radius);
    case Plane.FLOOR:
      return new Vector3(-cos_a * radius, 0, sin_a * radius);
    default: {
      // Generic: project angle onto plane's local axes
      // Uses same sign conventions as primaries:
      // cos_a maps to "right" (negated for screen-left = world-right),
      // sin_a maps to "up" (negated for canvas Y-down → Y-up)
      const { up, right } = deriveUpRight(PLANE_NORMALS[plane]);
      return new Vector3()
        .addScaledVector(right, -cos_a * radius)
        .addScaledVector(up, -sin_a * radius);
    }
  }
}
```

- [ ] **Step 5: Extend getPlaneRotation and getPlaneQuaternion**

Replace the switch with a generic computation for non-primary planes:

```typescript
export function getPlaneRotation(plane: Plane): Euler {
  switch (plane) {
    case Plane.WALL:  return new Euler(0, 0, 0);
    case Plane.WHEEL: return new Euler(0, Math.PI / 2, 0);
    case Plane.FLOOR: return new Euler(-Math.PI / 2, 0, 0);
    default: {
      // Derive from normal — rotate from Z-forward (Wall default) to plane normal
      const normal = PLANE_NORMALS[plane];
      const quat = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), normal);
      const euler = new Euler().setFromQuaternion(quat);
      return euler;
    }
  }
}
```

- [ ] **Step 6: Run plane normal tests**

Run: `npx vitest run tests/unit/3d/plane-normals.test.ts`
Expected: ALL PASS

- [ ] **Step 7: Run full type check**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: Remaining errors only in `plane-mode-configs.ts` (GRID_OFFSETS missing new PlaneMode entries — addressed in Task 4)

- [ ] **Step 8: Commit**

```
feat(3d): extend plane-transforms with normals and position mapping for all 9 planes
```

---

## Task 3: Add `plane` Field to MotionData

**Files:**
- Modify: `src/lib/shared/pictograph/shared/domain/models/MotionData.ts`
- Create: `tests/unit/3d/sequence-converter-plane.test.ts`

- [ ] **Step 1: Add plane field to MotionData interface**

In `MotionData.ts`, add after the `skewDir` field (line 56):

```typescript
  // Which 3D plane this motion is performed on.
  // Absent/undefined = Plane.WALL (backward compatible).
  // Only used by the 3D viewer — 2D pictographs ignore this field.
  readonly plane?: Plane;
```

Add the import at the top of the file:

```typescript
import { Plane } from "../../../3d/domain/enums/Plane";
```

Note: Importing from 3d into pictograph creates a cross-boundary dependency. If this is problematic, move the `Plane` enum to a shared location like `src/lib/shared/foundation/domain/enums/`. For now, the direct import works and avoids premature refactoring.

- [ ] **Step 2: Add plane passthrough in createMotionData factory**

In the `createMotionData` function, add after the `skewDir` line (line 112):

```typescript
    plane: data.plane ?? undefined,
```

This ensures plane data round-trips through the factory (used by import/Firebase deserialization).

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit 2>&1 | head -10`
Expected: No new errors from this change (field is optional)

- [ ] **Step 4: Commit**

```
feat(data): add optional plane field to MotionData for per-beat plane assignment
```

---

## Task 4: Wire SequenceConverter to Read motion.plane

**Files:**
- Modify: `src/lib/shared/3d/services/implementations/SequenceConverter.ts`
- Test: `tests/unit/3d/sequence-converter-plane.test.ts`

- [ ] **Step 1: Write converter plane passthrough tests**

Create `tests/unit/3d/sequence-converter-plane.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { SequenceConverter } from "$lib/shared/3d/services/implementations/SequenceConverter";
import { Plane } from "$lib/shared/3d/domain/enums/Plane";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { StepData } from "$lib/features/create/shared/domain/models/StepData";

const converter = new SequenceConverter();

describe("SequenceConverter plane passthrough", () => {
  it("reads motion.plane when no modeConfig is active", () => {
    const motion = createMotionData({ plane: Plane.WHEEL });
    const config = converter.motionDataToConfig3D(motion);
    expect(config.plane).toBe(Plane.WHEEL);
  });

  it("defaults to WALL when motion has no plane field", () => {
    const motion = createMotionData({});
    const config = converter.motionDataToConfig3D(motion);
    expect(config.plane).toBe(Plane.WALL);
  });

  it("modeConfig overrides motion.plane", () => {
    const motion = createMotionData({ plane: Plane.FLOOR });
    const modeConfig = {
      facingAngle: 0,
      bluePlane: Plane.WHEEL,
      redPlane: Plane.WHEEL,
      rotationPlane: Plane.WALL,
      blueLateralOffset: 0,
      redLateralOffset: 0,
    };

    const beat = {
      stepNumber: 1,
      motions: {
        [MotionColor.BLUE]: motion,
        [MotionColor.RED]: createMotionData({ plane: Plane.FLOOR }),
      },
      duration: 1,
      blueReversal: false,
      redReversal: false,
      isBlank: false,
      id: "test",
    } as unknown as StepData;

    const result = converter.beatDataToConfigs(beat, Plane.WALL, modeConfig);
    // modeConfig.bluePlane (WHEEL) should override motion.plane (FLOOR)
    expect(result.blue?.plane).toBe(Plane.WHEEL);
  });

  it("uses motion.plane when modeConfig is absent", () => {
    const blueMotion = createMotionData({ plane: Plane.FLOOR, color: MotionColor.BLUE });
    const redMotion = createMotionData({ plane: Plane.WHEEL, color: MotionColor.RED });

    const beat = {
      stepNumber: 1,
      motions: {
        [MotionColor.BLUE]: blueMotion,
        [MotionColor.RED]: redMotion,
      },
      duration: 1,
      blueReversal: false,
      redReversal: false,
      isBlank: false,
      id: "test",
    } as unknown as StepData;

    const result = converter.beatDataToConfigs(beat);
    expect(result.blue?.plane).toBe(Plane.FLOOR);
    expect(result.red?.plane).toBe(Plane.WHEEL);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/3d/sequence-converter-plane.test.ts`
Expected: FAIL — `motionDataToConfig3D` ignores `motion.plane`, uses the `plane` parameter instead

- [ ] **Step 3: Update motionDataToConfig3D to read motion.plane**

In `SequenceConverter.ts`, change `motionDataToConfig3D` (line 31-50):

```typescript
  motionDataToConfig3D(
    motion: MotionData,
    fallbackPlane: Plane = Plane.WALL
  ): MotionConfig3D {
    const turns = motion.turns === "fl" ? 0 : (motion.turns as number);
    // Per-beat plane from authored data, falling back to caller-provided plane
    const plane = motion.plane ?? fallbackPlane;

    return {
      plane,
      startLocation: motion.startLocation,
      endLocation: motion.endLocation,
      motionType: motion.motionType,
      rotationDirection: motion.rotationDirection,
      turns,
      startOrientation: motion.startOrientation,
      endOrientation: motion.endOrientation,
    };
  }
```

- [ ] **Step 4: Update beatDataToConfigs precedence**

In `beatDataToConfigs` (line 55-88), the precedence should be: `modeConfig > motion.plane > fallbackPlane`. The current code passes `bluePlane` (from modeConfig or fallback) directly to `motionDataToConfig3D` as the `plane` parameter. Since `motionDataToConfig3D` now reads `motion.plane ?? fallbackPlane`, and `modeConfig.bluePlane` is passed as the fallback, the precedence is already correct:

- With modeConfig: `motion.plane ?? modeConfig.bluePlane` — but we want modeConfig to WIN. So swap the precedence in beatDataToConfigs:

```typescript
    // Precedence: modeConfig (whole-sequence override) > motion.plane (per-beat authored) > fallback
    const bluePlane = modeConfig?.bluePlane ?? plane;
    const redPlane = modeConfig?.redPlane ?? plane;
```

And in `motionDataToConfig3D`, the fallback parameter IS this resolved plane, so `motion.plane ?? fallbackPlane` gives us:
- modeConfig active: `motion.plane ?? modeConfig.bluePlane` — WRONG, motion.plane would override modeConfig.

We need to handle this differently. When modeConfig is active, don't let motion.plane override it. Change `beatDataToConfigs`:

```typescript
    // When modeConfig is active, it's a whole-sequence rendering override.
    // Per-beat motion.plane is only used when no modeConfig is active.
    const useMotionPlane = !modeConfig;

    return {
      stepNumber,
      blue:
        blueMotion && blueMotion.isVisible !== false
          ? {
              ...this.motionDataToConfig3D(
                blueMotion,
                useMotionPlane ? undefined : bluePlane
              ),
              lateralOffset: blueOffset || undefined,
              rotationPlane: rotPlane,
              // If modeConfig is active, force its plane regardless of motion.plane
              ...(modeConfig ? { plane: bluePlane } : {}),
            }
          : null,
      red:
        redMotion && redMotion.isVisible !== false
          ? {
              ...this.motionDataToConfig3D(
                redMotion,
                useMotionPlane ? undefined : redPlane
              ),
              lateralOffset: redOffset || undefined,
              rotationPlane: rotPlane,
              ...(modeConfig ? { plane: redPlane } : {}),
            }
          : null,
    };
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/unit/3d/sequence-converter-plane.test.ts`
Expected: ALL PASS

- [ ] **Step 6: Run full test suite**

Run: `npx vitest run`
Expected: No regressions

- [ ] **Step 7: Commit**

```
feat(3d): wire SequenceConverter to read motion.plane with modeConfig precedence
```

---

## Task 5: Add CUSTOM PlaneMode for Independent Per-Hand Planes

**Files:**
- Modify: `src/lib/shared/3d/domain/enums/PlaneMode.ts`
- Modify: `src/lib/shared/3d/domain/constants/plane-mode-configs.ts`
- Modify: `src/lib/shared/3d/state/avatar-instance-state.svelte.ts`

- [ ] **Step 1: Add CUSTOM to PlaneMode enum**

In `PlaneMode.ts`, add:

```typescript
export enum PlaneMode {
  WALL = "wall",
  DUAL_WHEEL = "dual-wheel",
  /** Per-hand independent plane selection — not a preset, user picks each hand's plane */
  CUSTOM = "custom",
}
```

- [ ] **Step 2: Add CUSTOM config to plane-mode-configs.ts**

CUSTOM mode uses WALL defaults — the actual planes come from the per-hand state, not the config. Add to `PLANE_MODE_CONFIGS`:

```typescript
  [PlaneMode.CUSTOM]: {
    facingAngle: 0,
    bluePlane: Plane.WALL,
    redPlane: Plane.WALL,
    rotationPlane: Plane.WALL,
    blueLateralOffset: 0,
    redLateralOffset: 0,
  },
```

Add to `GRID_OFFSETS`:

```typescript
  [PlaneMode.CUSTOM]: 0.3, // Same as wall — per-hand offsets handled separately
```

- [ ] **Step 3: Add per-hand plane state to avatar-instance-state**

In `avatar-instance-state.svelte.ts`, add reactive state for each hand's plane:

```typescript
let customBluePlane = $state<Plane>(Plane.WALL);
let customRedPlane = $state<Plane>(Plane.WALL);

function setHandPlane(hand: "blue" | "red", plane: Plane) {
  if (hand === "blue") customBluePlane = plane;
  else customRedPlane = plane;

  // Switch to CUSTOM mode if not already
  if (planeMode !== PlaneMode.CUSTOM) {
    planeMode = PlaneMode.CUSTOM;
  }

  // Re-convert with custom planes
  reloadWithCurrentPlanes();
}

function reloadWithCurrentPlanes() {
  if (!loadedSequence) return;

  const modeConfig = planeMode === PlaneMode.CUSTOM
    ? {
        facingAngle: 0,
        bluePlane: customBluePlane,
        redPlane: customRedPlane,
        rotationPlane: Plane.WALL,
        blueLateralOffset: 0,
        redLateralOffset: 0,
      }
    : getEffectiveModeConfig(planeMode);

  const motionConfigs = sequenceConverter.sequenceToMotionConfigs(
    loadedSequence,
    Plane.WALL,
    modeConfig
  );
  const startConfig = sequenceConverter.getStartPositionConfigs(
    loadedSequence,
    Plane.WALL,
    modeConfig
  );
  stepConfigs = startConfig ? [startConfig, ...motionConfigs] : motionConfigs;
  updateVisibilityFromStep(stepConfigs[currentStepIndex] ?? stepConfigs[0]);
}
```

Expose in the returned state object:

```typescript
get customBluePlane() { return customBluePlane; },
get customRedPlane() { return customRedPlane; },
setHandPlane,
```

- [ ] **Step 4: Update setPlaneMode to reset custom planes when switching to a preset**

When switching from CUSTOM to WALL or DUAL_WHEEL, reset the custom planes:

```typescript
function setPlaneMode(mode: PlaneMode) {
  planeMode = mode;
  if (mode !== PlaneMode.CUSTOM) {
    // Reset custom planes to match the preset
    const config = PLANE_MODE_CONFIGS[mode];
    customBluePlane = config.bluePlane;
    customRedPlane = config.redPlane;
  }
  // ... existing re-conversion logic
}
```

- [ ] **Step 5: Run type check**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 6: Commit**

```
feat(3d): add CUSTOM PlaneMode with per-hand plane state in avatar instance
```

---

## Task 6: Rewrite PlaneModeToggle as Per-Hand Plane Selector

**Files:**
- Rewrite: `src/lib/shared/3d/components/controls/PlaneModeToggle.svelte`
- Modify: `src/lib/shared/3d/components/panels/SceneOverlayControls.svelte`

- [ ] **Step 1: Rewrite PlaneModeToggle with per-hand plane dropdowns**

Replace the contents of `PlaneModeToggle.svelte`:

```svelte
<script lang="ts">
  import { Plane, PLANE_COLORS, PRIMARY_PLANES } from "../../domain/enums/Plane";
  import { PlaneMode } from "../../domain/enums/PlaneMode";

  interface Props {
    mode: PlaneMode;
    bluePlane: Plane;
    redPlane: Plane;
    onModeChange: (mode: PlaneMode) => void;
    onHandPlaneChange: (hand: "blue" | "red", plane: Plane) => void;
  }

  let { mode, bluePlane, redPlane, onModeChange, onHandPlaneChange }: Props = $props();

  const primaryPlanes = [Plane.WALL, Plane.WHEEL, Plane.FLOOR];

  const planeLabels: Record<string, string> = {
    [Plane.WALL]: "Wall",
    [Plane.WHEEL]: "Wheel",
    [Plane.FLOOR]: "Floor",
  };

  function handlePlaneChange(hand: "blue" | "red", value: string) {
    onHandPlaneChange(hand, value as Plane);
  }

  function resetToWall() {
    onModeChange(PlaneMode.WALL);
  }
</script>

<div class="plane-controls">
  <div class="hand-plane">
    <span class="hand-dot" style="background: #4a90d9;"></span>
    <select
      value={bluePlane}
      onchange={(e) => handlePlaneChange("blue", e.currentTarget.value)}
      class="plane-select"
    >
      {#each primaryPlanes as p}
        <option value={p}>{planeLabels[p]}</option>
      {/each}
    </select>
  </div>

  <div class="hand-plane">
    <span class="hand-dot" style="background: #d94a4a;"></span>
    <select
      value={redPlane}
      onchange={(e) => handlePlaneChange("red", e.currentTarget.value)}
      class="plane-select"
    >
      {#each primaryPlanes as p}
        <option value={p}>{planeLabels[p]}</option>
      {/each}
    </select>
  </div>

  {#if mode !== PlaneMode.WALL || bluePlane !== Plane.WALL || redPlane !== Plane.WALL}
    <button class="reset-btn" onclick={resetToWall} title="Reset both to Wall">
      <i class="fas fa-undo" aria-hidden="true"></i>
    </button>
  {/if}
</div>

<style>
  .plane-controls {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .hand-plane {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .hand-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .plane-select {
    padding: 4px 6px;
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.8);
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    backdrop-filter: blur(8px);
    outline: none;
  }

  .plane-select:hover {
    border-color: rgba(255, 255, 255, 0.3);
  }

  .plane-select option {
    background: #1a1a2e;
    color: #fff;
  }

  .reset-btn {
    padding: 4px 8px;
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.4);
    font-size: 11px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .reset-btn:hover {
    color: rgba(255, 255, 255, 0.8);
    border-color: rgba(255, 255, 255, 0.2);
  }
</style>
```

- [ ] **Step 2: Update SceneOverlayControls props**

In `SceneOverlayControls.svelte`, update the Props interface and the PlaneModeToggle usage to pass the new props:

Add to Props:
```typescript
  bluePlane?: Plane;
  redPlane?: Plane;
  onHandPlaneChange?: (hand: "blue" | "red", plane: Plane) => void;
```

Update the template where PlaneModeToggle is rendered:
```svelte
{#if planeMode !== undefined && onPlaneModeChange && onHandPlaneChange}
  <PlaneModeToggle
    mode={planeMode}
    bluePlane={bluePlane ?? Plane.WALL}
    redPlane={redPlane ?? Plane.WALL}
    onModeChange={onPlaneModeChange}
    onHandPlaneChange={onHandPlaneChange}
  />
{/if}
```

- [ ] **Step 3: Thread per-hand plane state through Viewer3DCanvas → SceneOverlayControls**

In `src/lib/shared/3d/components/Viewer3DCanvas.svelte`, SceneOverlayControls receives its props from the viewer3D context. The existing pattern threads `avatarState.planeMode` and `avatarState.setPlaneMode` through. Add the new per-hand props alongside them:

```typescript
bluePlane={avatarState.customBluePlane}
redPlane={avatarState.customRedPlane}
onHandPlaneChange={avatarState.setHandPlane}
```

Follow the exact pattern used for `planeMode={avatarState.planeMode}` and `onPlaneModeChange={avatarState.setPlaneMode}` — search for those in the template and add the new props next to them.

- [ ] **Step 4: Run type check**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 5: Commit**

```
feat(3d): replace binary plane toggle with per-hand plane selectors
```

---

## Task 7: Auto-Show Grid for Active Plane

**Files:**
- Modify: `src/lib/shared/3d/state/viewer-3d-state.svelte.ts`

- [ ] **Step 1: Add derived effect to auto-show active planes**

In `viewer-3d-state.svelte.ts`, add an effect that watches the avatar's per-hand planes and automatically adds them to the visible planes set:

```typescript
// Auto-show grid for non-wall planes when a hand is assigned to them
$effect(() => {
  const blue = avatarState.customBluePlane;
  const red = avatarState.customRedPlane;

  // Always keep wall visible. Add wheel/floor when hands use them.
  if (blue !== Plane.WALL && !visiblePlanes.has(blue)) {
    visiblePlanes.add(blue);
    persistPlanes();
  }
  if (red !== Plane.WALL && !visiblePlanes.has(red)) {
    visiblePlanes.add(red);
    persistPlanes();
  }
});
```

This is a quality-of-life feature: when you assign blue to Wheel plane, the Wheel grid circle automatically appears in the viewer so you can see where the hand will trace.

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```
feat(3d): auto-show grid circle when hand assigned to non-wall plane
```

---

## Task 8: Final Verification

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: ALL PASS, no regressions

- [ ] **Step 2: Run full type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Verify visually**

Load a diamond-mode sequence in the 3D viewer. Use the per-hand plane selectors:
1. Set blue to Wheel — blue hand should trace on the side-profile circle, wheel grid should auto-appear
2. Set red to Floor — red hand should trace on the horizontal circle, floor grid should auto-appear
3. Trails should paint on the correct planes
4. Reset button should return both to Wall
5. Dual Wheel preset (if still in PlaneMode dropdown) should still work

If you cannot verify visually, say: "I cannot verify this visually. Please load a diamond-mode sequence, switch blue to Wheel and red to Floor, and confirm the props trace on their respective plane circles."

- [ ] **Step 5: Commit any fixes from verification**

```
fix(3d): address visual issues from plane system verification
```

---

## What This Does NOT Build

- **Per-beat plane editor (Lab Tab)** — Future session. The data model supports it, but the UI for painting planes per beat is separate scope.
- **Premium gating** — The plane selectors are visible to all users. Premium gate is a separate task that hides the selectors for free users.
- **Avatar body reorientation** — The body stays wall-oriented. IK reaches to correct positions but the torso doesn't rotate to match non-wall planes.
- **Box mode plane switching** — L9 content. The fusion planes are in the enum but no UI exposes them.
- **2D pictograph plane indicators** — The 2D view doesn't show plane assignments. Known limitation.
