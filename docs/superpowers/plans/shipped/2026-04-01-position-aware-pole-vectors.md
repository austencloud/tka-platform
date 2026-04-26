# Position-Aware Pole Vectors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded elbow bend direction with dynamic, plane-aware pole vectors so avatar arms stop clipping through the torso.

**Architecture:** A new stateless `ElbowPoleComputer` service computes per-arm pole vectors from the prop's plane and hand position relative to body center. The `AvatarAnimator` feeds these into the existing `IKSolver` via a new optional `poleHint` field on `IKTarget`. Smoothing reuses the existing lerp pipeline.

**Tech Stack:** Three.js (Vector3 math), TypeScript, Vitest for unit tests

**Spec:** `docs/superpowers/specs/2026-04-01-position-aware-pole-vectors-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/lib/shared/3d/services/contracts/IElbowPoleComputer.ts` | Create | Interface — single `computePoleVector` method |
| `src/lib/shared/3d/services/implementations/ElbowPoleComputer.ts` | Create | Pure math — plane-aware pole vector computation |
| `src/lib/shared/3d/services/contracts/IIKSolver.ts` | Modify | Add `poleHint?: Vector3` to `IKTarget` |
| `src/lib/shared/3d/services/contracts/IAvatarAnimator.ts` | Modify | Add `plane?: Plane` to `HandPose` |
| `src/lib/shared/3d/services/implementations/IKSolver.ts` | Modify | Read `poleHint` from target in `solve()` and `solveAndApply()` |
| `src/lib/shared/3d/services/implementations/AvatarAnimator.ts` | Modify | Store planes, compute + smooth pole vectors, pass to IK |
| `src/lib/shared/3d/components/Avatar3D.svelte` | Modify | Instantiate `ElbowPoleComputer`, pass to `AvatarAnimator` |
| `tests/unit/3d-animation/ElbowPoleComputer.test.ts` | Create | Unit tests for pole vector math |

---

## Task 1: Add `poleHint` to `IKTarget` interface

**Files:**
- Modify: `src/lib/shared/3d/services/contracts/IIKSolver.ts:42-52`

- [ ] **Step 1: Add optional `poleHint` field to `IKTarget`**

In `IIKSolver.ts`, add one field to the `IKTarget` interface:

```typescript
export interface IKTarget {
  /** Target position in world space */
  position: Vector3;
  /** Optional target rotation for the end effector */
  rotation?: Quaternion;
  /** Blend weight (0-1) for this target */
  weight?: number;
  /** Preferred elbow bend direction. If absent, defaults to (0, 0, -1). */
  poleHint?: Vector3;
}
```

- [ ] **Step 2: Run typecheck to verify no breakage**

Run: `npm run check`
Expected: PASS — the field is optional, so all existing `IKTarget` construction sites remain valid.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/services/contracts/IIKSolver.ts
git commit -m "feat(3d): add optional poleHint to IKTarget interface"
```

---

## Task 2: Wire `poleHint` through IKSolver

**Files:**
- Modify: `src/lib/shared/3d/services/implementations/IKSolver.ts:27-62`

- [ ] **Step 1: Update `solve()` to read `poleHint` from target**

Replace the hardcoded `new Vector3(0, 0, -1)` with `target.poleHint ?? new Vector3(0, 0, -1)`:

```typescript
solve(
  chain: BoneChain,
  target: IKTarget,
  algorithm: IKAlgorithm = "analytic",
  constraints?: JointConstraints[]
): IKSolution {
  const poleHint = target.poleHint ?? new Vector3(0, 0, -1);
  switch (algorithm) {
    case "analytic":
      return this.solveTwoBone(chain, target.position, poleHint);
    case "ccd":
      return this.solveCCD(chain, target, constraints);
    case "fabrik":
      return this.solveFABRIK(chain, target);
    default:
      return this.solveTwoBone(chain, target.position, poleHint);
  }
}
```

`solveAndApply` already calls `this.solve()`, so it inherits the change automatically.

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/services/implementations/IKSolver.ts
git commit -m "feat(3d): wire poleHint through IKSolver.solve()"
```

---

## Task 3: Add `plane` to `HandPose` interface

**Files:**
- Modify: `src/lib/shared/3d/services/contracts/IAvatarAnimator.ts:14-23`

- [ ] **Step 1: Add optional `plane` field to `HandPose`**

```typescript
import type { Plane } from "../../domain/enums/Plane";

export interface HandPose {
  /** Target position in world space */
  targetPosition: Vector3;
  /** Target rotation for wrist (optional) */
  wristRotation?: Quaternion;
  /** Grip type for fingers — see GripType enum in GripPose.ts */
  gripType?: import("../../domain/models/GripPose").GripType;
  /** Which plane this hand's prop is operating on */
  plane?: Plane;
  /** Blend weight (0-1) */
  weight: number;
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: PASS — optional field, no existing code breaks.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/services/contracts/IAvatarAnimator.ts
git commit -m "feat(3d): add optional plane to HandPose interface"
```

---

## Task 4: Create `ElbowPoleComputer` — test first

**Files:**
- Create: `src/lib/shared/3d/services/contracts/IElbowPoleComputer.ts`
- Create: `src/lib/shared/3d/services/implementations/ElbowPoleComputer.ts`
- Create: `tests/unit/3d-animation/ElbowPoleComputer.test.ts`

- [ ] **Step 1: Create the interface**

```typescript
// src/lib/shared/3d/services/contracts/IElbowPoleComputer.ts

/**
 * IElbowPoleComputer
 *
 * Computes the optimal elbow bend direction (pole vector) for IK solving.
 * The pole vector tells the IK solver which way the elbow should point,
 * preventing arms from clipping through the torso.
 *
 * Pure function. No state. Each call is independent.
 */

import type { Vector3 } from "three";
import type { Plane } from "../../domain/enums/Plane";

export interface IElbowPoleComputer {
  /**
   * Compute the pole vector for one arm's IK solve.
   *
   * @param handTarget - Where the hand needs to be (world space)
   * @param plane - Which plane the prop is operating on (wall, wheel, floor)
   * @param side - Which arm ("left" or "right")
   * @param bodyCenter - Avatar's torso center position (world space)
   * @returns Normalized direction vector for elbow bend
   */
  computePoleVector(
    handTarget: Vector3,
    plane: Plane,
    side: "left" | "right",
    bodyCenter: Vector3
  ): Vector3;
}
```

- [ ] **Step 2: Write failing tests**

```typescript
// tests/unit/3d-animation/ElbowPoleComputer.test.ts

import { describe, it, expect } from "vitest";
import { Vector3 } from "three";
import { ElbowPoleComputer } from "$lib/shared/3d/services/implementations/ElbowPoleComputer";
import { Plane } from "$lib/shared/3d/domain/enums/Plane";

function expectNormalized(v: Vector3) {
  expect(v.length()).toBeCloseTo(1, 4);
}

function expectDominantComponent(v: Vector3, axis: "x" | "y" | "z") {
  const abs = { x: Math.abs(v.x), y: Math.abs(v.y), z: Math.abs(v.z) };
  const dominant = abs[axis];
  for (const [key, val] of Object.entries(abs)) {
    if (key !== axis) {
      expect(dominant).toBeGreaterThan(val);
    }
  }
}

describe("ElbowPoleComputer", () => {
  const computer = new ElbowPoleComputer();
  const bodyCenter = new Vector3(0, 1, 0);

  describe("all returned vectors are unit length", () => {
    it("wall plane", () => {
      const pole = computer.computePoleVector(
        new Vector3(0.3, 1.2, 0), Plane.WALL, "left", bodyCenter
      );
      expectNormalized(pole);
    });

    it("wheel plane", () => {
      const pole = computer.computePoleVector(
        new Vector3(0, 1.2, 0.3), Plane.WHEEL, "right", bodyCenter
      );
      expectNormalized(pole);
    });

    it("floor plane", () => {
      const pole = computer.computePoleVector(
        new Vector3(0.3, 1, 0.3), Plane.FLOOR, "left", bodyCenter
      );
      expectNormalized(pole);
    });
  });

  describe("wall plane", () => {
    it("normal position: pole is primarily forward (+Z)", () => {
      // Left hand at its natural side (screen right = +X for skeleton left)
      const pole = computer.computePoleVector(
        new Vector3(0.3, 1.2, 0), Plane.WALL, "left", bodyCenter
      );
      expect(pole.z).toBeGreaterThan(0);
      expectDominantComponent(pole, "z");
    });

    it("cross-body reach: strong forward Z", () => {
      // Left hand crossing to -X (skeleton's right side)
      const pole = computer.computePoleVector(
        new Vector3(-0.3, 1.2, 0), Plane.WALL, "left", bodyCenter
      );
      expect(pole.z).toBeGreaterThan(0.5);
    });

    it("hand at south: forward Z + outward X bias", () => {
      // Left hand low (south position)
      const pole = computer.computePoleVector(
        new Vector3(0, 0.3, 0), Plane.WALL, "left", bodyCenter
      );
      expect(pole.z).toBeGreaterThan(0);
      // Left arm's outward is +X (skeleton left hand is at +X)
      expect(pole.x).toBeGreaterThan(0);
    });

    it("overhead position: pole shifts slightly downward", () => {
      // Left hand well above head (localY > 0.5 triggers highFactor)
      const pole = computer.computePoleVector(
        new Vector3(0, 2.2, 0), Plane.WALL, "left", bodyCenter
      );
      expect(pole.z).toBeGreaterThan(0);
      // Overhead adjustment adds negative Y component
      expect(pole.y).toBeLessThan(0);
    });
  });

  describe("wheel plane", () => {
    it("pole is primarily lateral (outward)", () => {
      const pole = computer.computePoleVector(
        new Vector3(0, 1.2, 0.3), Plane.WHEEL, "left", bodyCenter
      );
      // Left arm outward = +X
      expect(pole.x).toBeGreaterThan(0);
      expectDominantComponent(pole, "x");
    });

    it("right arm: opposite lateral direction", () => {
      const pole = computer.computePoleVector(
        new Vector3(0, 1.2, 0.3), Plane.WHEEL, "right", bodyCenter
      );
      // Right arm outward = -X
      expect(pole.x).toBeLessThan(0);
    });
  });

  describe("floor plane", () => {
    it("pole is primarily upward (+Y)", () => {
      const pole = computer.computePoleVector(
        new Vector3(0.3, 1, 0.3), Plane.FLOOR, "left", bodyCenter
      );
      expect(pole.y).toBeGreaterThan(0);
      expectDominantComponent(pole, "y");
    });

    it("hand near center: adds outward X bias", () => {
      // Hand nearly at body center
      const pole = computer.computePoleVector(
        new Vector3(0.02, 1, 0.02), Plane.FLOOR, "left", bodyCenter
      );
      expect(pole.y).toBeGreaterThan(0);
      // Left arm outward = +X
      expect(pole.x).toBeGreaterThan(0);
    });
  });

  describe("degenerate cases", () => {
    it("floor plane, hand directly above body: still returns valid vector", () => {
      // This could produce a pole parallel to target direction
      const pole = computer.computePoleVector(
        new Vector3(0, 2.5, 0), Plane.FLOOR, "left", bodyCenter
      );
      expectNormalized(pole);
      // Should still have some lateral component to avoid degenerate IK
      expect(Math.abs(pole.x) + Math.abs(pole.z)).toBeGreaterThan(0.1);
    });

    it("wheel plane, hand directly to the side: still returns valid vector", () => {
      const pole = computer.computePoleVector(
        new Vector3(0.5, 1, 0), Plane.WHEEL, "left", bodyCenter
      );
      expectNormalized(pole);
    });
  });

  describe("mixed planes: each arm independent", () => {
    it("left on wall, right on wheel: different dominant axes", () => {
      const leftPole = computer.computePoleVector(
        new Vector3(0.3, 1.2, 0), Plane.WALL, "left", bodyCenter
      );
      const rightPole = computer.computePoleVector(
        new Vector3(0, 1.2, 0.3), Plane.WHEEL, "right", bodyCenter
      );
      // Wall → Z dominant, Wheel → X dominant
      expectDominantComponent(leftPole, "z");
      expectDominantComponent(rightPole, "x");
    });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/unit/3d-animation/ElbowPoleComputer.test.ts`
Expected: FAIL — `ElbowPoleComputer` does not exist yet.

- [ ] **Step 4: Implement `ElbowPoleComputer`**

```typescript
// src/lib/shared/3d/services/implementations/ElbowPoleComputer.ts

/**
 * ElbowPoleComputer
 *
 * Computes where the elbow should point based on which plane the prop
 * is moving on and where the hand is relative to the body. This prevents
 * the avatar's arms from clipping through the torso.
 *
 * Think of it like this: when you spin a staff on the wall plane (in front
 * of you), your elbows naturally point forward. When spinning on the wheel
 * plane (beside you, like a cartwheel), your elbows point outward to the
 * sides. This service encodes that natural body awareness.
 */

import { Vector3 } from "three";
import type { IElbowPoleComputer } from "../contracts/IElbowPoleComputer";
import { Plane } from "../../domain/enums/Plane";

/**
 * Half the shoulder span in meters. Used to normalize cross-body
 * distances to a 0-1 range so the correction scales proportionally
 * to the body's actual width.
 */
const SHOULDER_HALF_WIDTH = 0.2;

export class ElbowPoleComputer implements IElbowPoleComputer {
  computePoleVector(
    handTarget: Vector3,
    plane: Plane,
    side: "left" | "right",
    bodyCenter: Vector3
  ): Vector3 {
    switch (plane) {
      case Plane.WALL:
        return this.computeWallPole(handTarget, side, bodyCenter);
      case Plane.WHEEL:
        return this.computeWheelPole(handTarget, side, bodyCenter);
      case Plane.FLOOR:
        return this.computeFloorPole(handTarget, side, bodyCenter);
      default:
        return new Vector3(0, 0, 1);
    }
  }

  /**
   * Wall plane (XY): props move on the vertical plane facing the audience.
   * Base direction: forward (+Z, toward the viewer).
   *
   * When the hand crosses the body's centerline, we push the elbow
   * forward more aggressively so the arm goes in front of the chest
   * instead of through it. When the hand is low (south positions),
   * we add a slight outward bias so the elbows don't pinch inward.
   */
  private computeWallPole(
    handTarget: Vector3,
    side: "left" | "right",
    bodyCenter: Vector3
  ): Vector3 {
    const pole = new Vector3(0, 0, 1); // Base: forward

    const localX = handTarget.x - bodyCenter.x;
    const localY = handTarget.y - bodyCenter.y;

    // sideSign: +1 for left arm (skeleton left = +X), -1 for right arm
    const sideSign = side === "left" ? 1 : -1;

    // Cross-body factor: high when hand is on the wrong side
    // Left arm's "wrong side" is -X, right arm's is +X
    const crossBody = Math.max(0, Math.min(1,
      (-localX * sideSign) / SHOULDER_HALF_WIDTH
    ));
    pole.z += crossBody * 0.8;

    // Low position: add outward X bias to prevent elbow pinch
    const lowFactor = Math.max(0, Math.min(1, -localY * 2));
    pole.x += sideSign * lowFactor * 0.3;

    // Overhead: slight downward bias for natural raised-arm pose
    const highFactor = Math.max(0, Math.min(1, (localY - 0.5) * 2));
    pole.y -= highFactor * 0.2;

    return pole.normalize();
  }

  /**
   * Wheel plane (YZ): props move on the vertical plane perpendicular
   * to the audience (like a cartwheel beside the body).
   * Base direction: outward laterally (away from the body center).
   *
   * When the hand is in front of or behind the body, we add a vertical
   * bias so the elbow doesn't collide with the torso's side.
   */
  private computeWheelPole(
    handTarget: Vector3,
    side: "left" | "right",
    bodyCenter: Vector3
  ): Vector3 {
    // Left arm outward = +X, right arm outward = -X
    const outwardSign = side === "left" ? 1 : -1;
    const pole = new Vector3(outwardSign, 0, 0); // Base: lateral outward

    const localZ = handTarget.z - bodyCenter.z;
    const localY = handTarget.y - bodyCenter.y;

    // Forward/back adjustment: add upward bias when hand is in front/behind
    const depthFactor = Math.min(1, Math.abs(localZ) * 2);
    pole.y += depthFactor * 0.3;

    // Low position: increase outward bias
    const lowFactor = Math.max(0, Math.min(1, -localY * 2));
    pole.x += outwardSign * lowFactor * 0.2;

    return pole.normalize();
  }

  /**
   * Floor plane (XZ): props move on the horizontal plane at roughly
   * waist/chest height (like spinning a plate on a table).
   * Base direction: upward (+Y, elbows point to the ceiling).
   *
   * When the hand is near the body center on the horizontal plane,
   * we add outward X bias so the elbow doesn't drop into the torso.
   */
  private computeFloorPole(
    handTarget: Vector3,
    side: "left" | "right",
    bodyCenter: Vector3
  ): Vector3 {
    const pole = new Vector3(0, 1, 0); // Base: upward

    const localX = handTarget.x - bodyCenter.x;
    const localZ = handTarget.z - bodyCenter.z;

    // How close is the hand to body center on the horizontal plane?
    const horizontalDist = Math.sqrt(localX * localX + localZ * localZ);
    const centerProximity = Math.max(0, Math.min(1,
      1 - horizontalDist / SHOULDER_HALF_WIDTH
    ));

    // Near center: push elbow outward
    const outwardSign = side === "left" ? 1 : -1;
    pole.x += outwardSign * centerProximity * 0.5;

    // Also add a slight forward bias to avoid degenerate cases
    // when hand is directly above (pole parallel to target direction)
    pole.z += 0.15;

    return pole.normalize();
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/unit/3d-animation/ElbowPoleComputer.test.ts`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/3d/services/contracts/IElbowPoleComputer.ts src/lib/shared/3d/services/implementations/ElbowPoleComputer.ts tests/unit/3d-animation/ElbowPoleComputer.test.ts
git commit -m "feat(3d): add ElbowPoleComputer with plane-aware pole vectors

Computes per-arm elbow bend direction based on which plane the prop
operates on (wall/wheel/floor) and hand position relative to the body.
Prevents arms from clipping through the torso during IK solving."
```

---

## Task 5: Integrate into `AvatarAnimator`

**Files:**
- Modify: `src/lib/shared/3d/services/implementations/AvatarAnimator.ts`

- [ ] **Step 1: Add `ElbowPoleComputer` dependency and pole smoothing state**

Add to imports and constructor:

```typescript
import type { IElbowPoleComputer } from "../contracts/IElbowPoleComputer";

// In class fields, after existing fields:
private poleComputer: IElbowPoleComputer | null;
private leftPoleVector = new Vector3(0, 0, 1);
private rightPoleVector = new Vector3(0, 0, 1);
```

Update constructor to accept optional `ElbowPoleComputer`:

```typescript
constructor(
  private ikSolver: IIKSolver,
  private skeleton: IAvatarSkeletonBuilder,
  poleComputer?: IElbowPoleComputer
) {
  this.poleComputer = poleComputer ?? null;
  // ... existing init
}
```

- [ ] **Step 2: Store plane in `setHandTargetsFromProps()`**

After setting `targetPosition` for each hand, also store the plane:

```typescript
if (blueProp) {
  this.targetPose.leftHand = {
    targetPosition: new Vector3(
      blueProp.worldPosition.x - ox,
      blueProp.worldPosition.y - oy,
      blueProp.worldPosition.z - oz
    ),
    plane: blueProp.plane,
    weight: 1,
  };
} else {
  this.targetPose.leftHand = { ...this.idlePose.leftHand };
}

if (redProp) {
  this.targetPose.rightHand = {
    targetPosition: new Vector3(
      redProp.worldPosition.x - ox,
      redProp.worldPosition.y - oy,
      redProp.worldPosition.z - oz
    ),
    plane: redProp.plane,
    weight: 1,
  };
} else {
  this.targetPose.rightHand = { ...this.idlePose.rightHand };
}
```

- [ ] **Step 3: Propagate plane through blending and final pose**

The existing `blendToTarget()` lerps position and weight but doesn't copy `plane`. The `plane` is discrete (not interpolated), so copy it from the target each frame. Add after the weight lerps in `blendToTarget()`:

```typescript
// Plane is discrete — always take the latest target's plane
this.currentPose.leftHand.plane = this.targetPose.leftHand.plane;
this.currentPose.rightHand.plane = this.targetPose.rightHand.plane;
```

Similarly in `computeFinalPose()`, preserve plane when cloning:

```typescript
const result: BodyPose = {
  leftHand: {
    targetPosition: this.currentPose.leftHand.targetPosition.clone(),
    plane: this.currentPose.leftHand.plane,
    weight: this.currentPose.leftHand.weight,
  },
  rightHand: {
    targetPosition: this.currentPose.rightHand.targetPosition.clone(),
    plane: this.currentPose.rightHand.plane,
    weight: this.currentPose.rightHand.weight,
  },
  timestamp: this.currentPose.timestamp,
};
```

- [ ] **Step 4: Compute and smooth pole vectors in `applyIKToSkeleton()`**

Replace the existing `applyIKToSkeleton` method:

```typescript
private applyIKToSkeleton(pose: BodyPose): void {
  const state = this.skeleton.getState();
  if (!state.isLoaded) return;

  const leftChain = this.skeleton.getLeftArmChain();
  const rightChain = this.skeleton.getRightArmChain();

  // Compute body center from Hips bone (or default to origin)
  const bodyCenter = new Vector3(0, 0, 0);
  const hipsBone = state.bones.get("Hips");
  if (hipsBone) {
    hipsBone.getWorldPosition(bodyCenter);
  }

  if (leftChain) {
    const target: IKTarget = {
      position: pose.leftHand.targetPosition,
      weight: pose.leftHand.weight,
    };

    if (this.poleComputer && pose.leftHand.plane) {
      const idealPole = this.poleComputer.computePoleVector(
        pose.leftHand.targetPosition,
        pose.leftHand.plane,
        "left",
        bodyCenter
      );
      this.leftPoleVector.lerp(idealPole, this.smoothingFactor);
      this.leftPoleVector.normalize();
      target.poleHint = this.leftPoleVector.clone();
    }

    this.ikSolver.solveAndApply(leftChain, target);
  }

  if (rightChain) {
    const target: IKTarget = {
      position: pose.rightHand.targetPosition,
      weight: pose.rightHand.weight,
    };

    if (this.poleComputer && pose.rightHand.plane) {
      const idealPole = this.poleComputer.computePoleVector(
        pose.rightHand.targetPosition,
        pose.rightHand.plane,
        "right",
        bodyCenter
      );
      this.rightPoleVector.lerp(idealPole, this.smoothingFactor);
      this.rightPoleVector.normalize();
      target.poleHint = this.rightPoleVector.clone();
    }

    this.ikSolver.solveAndApply(rightChain, target);
  }

  this.skeleton.updateMatrices();
}
```

- [ ] **Step 5: Add `IKTarget` import**

Add to the import block at the top of AvatarAnimator.ts:

```typescript
import type { IKTarget } from "../contracts/IIKSolver";
```

- [ ] **Step 6: Run typecheck**

Run: `npm run check`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/shared/3d/services/implementations/AvatarAnimator.ts
git commit -m "feat(3d): integrate ElbowPoleComputer into AvatarAnimator

AvatarAnimator now computes per-arm pole vectors from prop plane data
and smoothly interpolates them between frames. Falls back to default
behavior when no pole computer is provided."
```

---

## Task 6: Wire up in `Avatar3D.svelte`

**Files:**
- Modify: `src/lib/shared/3d/components/Avatar3D.svelte:226-238`

- [ ] **Step 1: Import and instantiate `ElbowPoleComputer`**

Add import:

```typescript
import { ElbowPoleComputer } from "../services/implementations/ElbowPoleComputer";
```

Update the service creation block (around line 232):

```typescript
const skeleton = new AvatarSkeletonBuilder();
const solver = new IKSolver();
const poleComputer = new ElbowPoleComputer();
const animator = new AvatarAnimator(solver, skeleton, poleComputer);
```

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: PASS

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: All existing tests PASS, plus the new ElbowPoleComputer tests.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/3d/components/Avatar3D.svelte
git commit -m "feat(3d): wire ElbowPoleComputer into Avatar3D

Avatar now uses plane-aware pole vectors for IK solving. Elbows bend
in the natural direction for each plane instead of always backward."
```

---

## Task 7: Verify visually

- [ ] **Step 1: Verify the change works**

Navigate to the 3D viewer with a sequence loaded. Check:
1. Arms no longer clip through the torso on wall plane sequences
2. Elbows visibly point forward (toward camera) instead of backward
3. Cross-body reaches show elbows swinging out in front
4. No elbow popping during transitions between beats

If verification is not possible via automated tools, state: "I cannot verify this visually. Please load a sequence in the 3D viewer and check that elbows now bend forward instead of backward. Particularly check cross-body positions where hands reach to the opposite side."

- [ ] **Step 2: Run full test suite one final time**

Run: `npm test`
Expected: All tests PASS.
