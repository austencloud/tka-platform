# Turn-In-Place Animation — Phase 1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the three documented gaps in the existing leg IK stack (hinge-constrained knee solver, foot rotation alignment, contact curves) and extend root motion extraction to include yaw delta, so the disabled `FootPlanter` can be safely re-enabled and the rig can accept animation-driven turn rotation in Phase 2.

**Architecture:** New `ILegIKSolver` contract + `HingeConstrainedLegIKSolver` implementation alongside (not replacing) the existing arm-grade `IIKSolver`. New `ContactCurveData` / `ContactCurveCache` services for authored foot planting metadata. `FootPlanter` rewired to call `ILegIKSolver` and consult contact curves when available (with velocity-threshold fallback). `RootMotionExtractor` gains yaw delta extraction from the Hips bone's rotation track. `PerformerRig` and `Avatar3D` wire the new pieces in behind opt-in flags so the museum FPS player is unaffected.

**Tech Stack:** TypeScript, Three.js (Bone, Vector3, Quaternion), Vitest, Svelte 5, ITI DI container.

**Spec:** `docs/superpowers/specs/2026-04-11-turn-in-place-animation-design.md`

---

## Prerequisites

Before starting, skim these files to build mental model:

- `src/lib/shared/3d/services/contracts/IFootPlanter.ts` — already defines the pipeline position and config
- `src/lib/shared/3d/services/implementations/FootPlanter.ts` — 379 lines, has velocity detection, pelvis adjust, blend ramps; only the solver call needs replacement
- `src/lib/shared/3d/services/contracts/IIKSolver.ts` — existing generic IK
- `src/lib/shared/3d/services/implementations/RootMotionExtractor.ts` — live, extracts X + forward translation; note the Mixamo coordinate mapping (`position.y` is forward, `position.z` is absolute hip height)
- `src/lib/shared/3d/services/contracts/IAvatarSkeletonBuilder.ts` — `BoneChain` shape includes `rootRestDir`, `middleRestDir`, `upperLength`, `lowerLength`
- `src/lib/shared/3d/components/Avatar3D.svelte:680-753` — the animate loop where FootPlanter is disabled and RootMotion is extracted
- `tests/unit/3d-animation/ElbowPoleComputer.test.ts` — reference for test style + coordinate convention comment block

**Coordinate convention (TKA / Mixamo, from ElbowPoleComputer.test.ts):**

```
character's right  = +X
character's left   = -X
forward (camera)   = +Z
up                 = +Y
```

Note: this is the *scene* convention. Inside the raw Hips bone after Blender FBX→GLB conversion, the local axes are different (Y = forward, Z = hip height). The `RootMotionExtractor` comment explains this.

---

## Task 1: Define `ILegIKSolver` contract

**Files:**
- Create: `src/lib/shared/3d/services/contracts/ILegIKSolver.ts`

This task is pure types — no tests, no behavior. Just the interface that Task 2 will implement.

- [ ] **Step 1: Create the contract file**

```typescript
// src/lib/shared/3d/services/contracts/ILegIKSolver.ts

/**
 * ILegIKSolver
 *
 * Hinge-constrained two-bone IK specialized for humanoid legs.
 * Unlike the generic IIKSolver (which treats every joint as freely
 * rotating, suitable for arms), this solver constrains the knee to
 * rotate only around a single axis — the sagittal axis of the UpLeg.
 * This is what prevents the knee splay artifacts that caused
 * FootPlanter to be disabled.
 *
 * After the position solve, an optional foot rotation alignment
 * pass rotates the ankle so the sole plane matches the ground
 * normal and the toe forward vector aligns with footForward.
 *
 * The solver is stateless: same input always returns same result.
 */

import { Vector3 } from "three";
import type { BoneChain } from "./IAvatarSkeletonBuilder";

export interface LegIKInput {
  /** The leg chain: UpLeg -> Leg -> Foot */
  chain: BoneChain;
  /** World-space target position for the foot bone */
  footTarget: Vector3;
  /** Ground normal at the target (for foot rotation alignment).
   *  Usually (0, 1, 0). */
  groundNormal: Vector3;
  /** Forward direction the foot should face (for toe alignment).
   *  Usually the avatar's facing direction. */
  footForward: Vector3;
  /** Sagittal hinge axis in UpLeg local space.
   *  Derived at skeleton-build time from the cross product of the
   *  rest-pose UpLeg direction and the rest-pose Leg direction —
   *  that gives the axis perpendicular to the natural bend plane. */
  kneeHingeAxis: Vector3;
  /** Forward vector biasing the knee bend direction. Prevents the
   *  knee from flipping backward when the target is directly below. */
  poleDirection: Vector3;
  /** Blend weight 0-1 (0 = leave bones untouched, 1 = fully IK pose) */
  weight: number;
}

export interface ILegIKSolver {
  /**
   * Solve leg IK in place — modifies the bones in `input.chain`
   * to satisfy the target within the hinge constraint.
   *
   * Stateless: same input produces same output, no internal memory.
   */
  solve(input: LegIKInput): void;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/shared/3d/services/contracts/ILegIKSolver.ts
git commit -m "feat(3d): add ILegIKSolver contract for hinge-constrained leg IK"
```

---

## Task 2: `HingeConstrainedLegIKSolver` — position solve (TDD)

**Files:**
- Create: `src/lib/shared/3d/services/implementations/HingeConstrainedLegIKSolver.ts`
- Create: `tests/unit/3d-animation/HingeConstrainedLegIKSolver.test.ts`

The algorithm is a variant of two-bone analytic IK where the knee joint is constrained to rotate only around a single axis. The test drives the implementation — start with a minimal case (target directly below hip, straight leg) and iterate.

**Algorithm outline** (for reference during implementation — Unity's `TwoBoneIKConstraint` and Unreal's `AnimNode_TwoBoneIK` are the canonical references):

1. Let `H` = hip world position, `T` = target, `L1` = `chain.upperLength`, `L2` = `chain.lowerLength`.
2. Compute `D = |T - H|`, clamp to `[|L1 - L2| * 1.01, (L1 + L2) * 0.99]` to avoid degenerate solutions.
3. **Knee bend angle** from law of cosines: `interiorKnee = acos((L1² + L2² - D²) / (2*L1*L2))`. Interior angle is the angle *at* the knee between the UpLeg and Leg vectors. The bend angle to apply is `π - interiorKnee`.
4. Apply bend: `knee.quaternion = setFromAxisAngle(kneeHingeAxis, bendAngle)` (local-space rotation around hinge axis).
5. **Aim the UpLeg:** after applying the knee bend, the foot is somewhere — usually not at the target. Compute the current foot world direction from hip and the desired direction from hip to target. Create a rotation that takes current→desired and apply it to UpLeg in local space (transform through parent inverse).
6. Update matrices after each bone change.

Edge cases to handle:
- **Target unreachable (`D > L1 + L2`):** clamp `D` and let the foot land at max extension — don't NaN.
- **Target too close (`D < |L1 - L2|`):** clamp `D` to prevent the acos domain violation.
- **Pole direction ignored:** the knee flipping backward isn't explicitly prevented by the hinge constraint alone. If the initial knee bend direction is wrong (knee points backward instead of forward), detect via dot product with `poleDirection` and negate `bendAngle`.
- **Weight < 1:** blend computed rotations with the original rotations via slerp after the full solve.

- [ ] **Step 1: Write the first failing test — straight-down reachable target**

```typescript
// tests/unit/3d-animation/HingeConstrainedLegIKSolver.test.ts
import { describe, it, expect } from "vitest";
import { Bone, Vector3, Quaternion, Object3D } from "three";
import { HingeConstrainedLegIKSolver } from "$lib/shared/3d/services/implementations/HingeConstrainedLegIKSolver";
import type { BoneChain } from "$lib/shared/3d/services/contracts/IAvatarSkeletonBuilder";
import type { LegIKInput } from "$lib/shared/3d/services/contracts/ILegIKSolver";

/**
 * Coordinate convention (TKA / Mixamo scene space):
 *   right = +X, left = -X, forward = +Z, up = +Y
 *
 * We build a synthetic leg chain with known lengths and rest poses so
 * the tests are deterministic. For the tests, we treat the bone local
 * axes as aligned with the world — this makes the hinge-axis math
 * transparent (hinge = world X = sagittal axis).
 */

function buildSyntheticLeg(): BoneChain {
  // Hip at origin (hip socket).
  // Knee at (0, -0.5, 0) in hip's local space.
  // Foot at (0, -1.0, 0) in knee's local space.
  // UpLeg length = 0.5, Leg length = 0.5, total = 1.0 (unit leg for clean math)
  const rootGroup = new Object3D();

  const hip = new Bone();
  hip.name = "LeftUpLeg";
  hip.position.set(0, 1, 0); // hip socket 1m above ground
  rootGroup.add(hip);

  const knee = new Bone();
  knee.name = "LeftLeg";
  knee.position.set(0, -0.5, 0);
  hip.add(knee);

  const foot = new Bone();
  foot.name = "LeftFoot";
  foot.position.set(0, -0.5, 0);
  knee.add(foot);

  rootGroup.updateMatrixWorld(true);

  return {
    root: hip,
    middle: knee,
    effector: foot,
    totalLength: 1.0,
    upperLength: 0.5,
    lowerLength: 0.5,
    rootRestDir: new Vector3(0, -1, 0),
    middleRestDir: new Vector3(0, -1, 0),
  };
}

function getWorldPos(bone: Bone): Vector3 {
  const v = new Vector3();
  bone.getWorldPosition(v);
  return v;
}

describe("HingeConstrainedLegIKSolver", () => {
  const solver = new HingeConstrainedLegIKSolver();

  describe("position solve — reachable targets", () => {
    it("reaches a target directly below the hip with slight offset", () => {
      const chain = buildSyntheticLeg();
      // Target: forward and down — reachable, requires knee bend
      const target = new Vector3(0, 0.2, 0.3);

      const input: LegIKInput = {
        chain,
        footTarget: target,
        groundNormal: new Vector3(0, 1, 0),
        footForward: new Vector3(0, 0, 1),
        kneeHingeAxis: new Vector3(1, 0, 0), // sagittal = X in this synthetic rig
        poleDirection: new Vector3(0, 0, 1), // knee bends forward
        weight: 1,
      };

      solver.solve(input);

      const footWorld = getWorldPos(chain.effector);
      expect(footWorld.distanceTo(target)).toBeLessThan(1e-3);
    });
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails with "module not found"**

```bash
npm test -- HingeConstrainedLegIKSolver.test.ts --run
```

Expected: failure from the import of `HingeConstrainedLegIKSolver` not existing yet.

- [ ] **Step 3: Create the solver skeleton**

```typescript
// src/lib/shared/3d/services/implementations/HingeConstrainedLegIKSolver.ts
import { Vector3, Quaternion } from "three";
import type { ILegIKSolver, LegIKInput } from "../contracts/ILegIKSolver";

export class HingeConstrainedLegIKSolver implements ILegIKSolver {
  // Reusable vectors to avoid per-frame allocation in hot path
  private readonly tempHipWorld = new Vector3();
  private readonly tempCurrentFootDir = new Vector3();
  private readonly tempTargetDir = new Vector3();
  private readonly tempAimRot = new Quaternion();
  private readonly tempParentWorldQuat = new Quaternion();
  private readonly tempLocalAimRot = new Quaternion();

  solve(input: LegIKInput): void {
    // Stub — test should still fail because bones are untouched
  }
}
```

- [ ] **Step 4: Run the test to confirm it still fails with "distanceTo > 1e-3"**

```bash
npm test -- HingeConstrainedLegIKSolver.test.ts --run
```

Expected: failure because the stub doesn't move bones.

- [ ] **Step 5: Implement the position solve**

Replace the stub `solve()` with:

```typescript
solve(input: LegIKInput): void {
  const { chain, footTarget, kneeHingeAxis, weight } = input;
  if (weight <= 0) return;

  const hip = chain.root;
  const knee = chain.middle;
  const foot = chain.effector;
  const L1 = chain.upperLength;
  const L2 = chain.lowerLength;

  // Save original rotations for weight blending
  const origHipQuat = hip.quaternion.clone();
  const origKneeQuat = knee.quaternion.clone();

  // World-space hip position
  hip.getWorldPosition(this.tempHipWorld);
  const hipWorld = this.tempHipWorld;

  // Distance to target, clamped to a reachable range
  const rawD = hipWorld.distanceTo(footTarget);
  const minReach = Math.abs(L1 - L2) * 1.01;
  const maxReach = (L1 + L2) * 0.99;
  const D = Math.max(minReach, Math.min(rawD, maxReach));

  // Law of cosines for interior knee angle (angle at the knee joint)
  const cosInterior = (L1 * L1 + L2 * L2 - D * D) / (2 * L1 * L2);
  const interiorKnee = Math.acos(Math.max(-1, Math.min(1, cosInterior)));
  const bendAngle = Math.PI - interiorKnee;

  // Apply knee bend around the hinge axis (knee's local space).
  // The hinge axis is in UpLeg local space, which at this point in the
  // solve is also the knee's local parent space — so we can apply it
  // as a knee-local rotation directly.
  const bendQuat = new Quaternion().setFromAxisAngle(kneeHingeAxis, bendAngle);
  knee.quaternion.copy(bendQuat);

  // After the knee bend, the foot is somewhere in world space — not at target.
  // Aim the UpLeg so the hip→foot direction matches hip→target direction.
  hip.updateMatrixWorld(true);
  knee.updateMatrixWorld(true);

  const currentFootWorld = new Vector3();
  foot.getWorldPosition(currentFootWorld);

  this.tempCurrentFootDir.subVectors(currentFootWorld, hipWorld).normalize();
  this.tempTargetDir.subVectors(footTarget, hipWorld).normalize();

  // Rotation in world space that aligns current → target
  this.tempAimRot.setFromUnitVectors(this.tempCurrentFootDir, this.tempTargetDir);

  // Convert to UpLeg's local space: parent^-1 * worldRot * parent
  if (hip.parent) {
    hip.parent.getWorldQuaternion(this.tempParentWorldQuat);
    this.tempLocalAimRot
      .copy(this.tempParentWorldQuat)
      .invert()
      .multiply(this.tempAimRot)
      .multiply(this.tempParentWorldQuat);
    hip.quaternion.premultiply(this.tempLocalAimRot);
  } else {
    hip.quaternion.premultiply(this.tempAimRot);
  }

  hip.updateMatrixWorld(true);
  knee.updateMatrixWorld(true);
  foot.updateMatrixWorld(true);

  // Weight blending: slerp from original rotations toward solved rotations
  if (weight < 1) {
    hip.quaternion.copy(origHipQuat).slerp(hip.quaternion, weight);
    knee.quaternion.copy(origKneeQuat).slerp(knee.quaternion, weight);
    hip.updateMatrixWorld(true);
    knee.updateMatrixWorld(true);
    foot.updateMatrixWorld(true);
  }
}
```

- [ ] **Step 6: Run the test, verify it passes**

```bash
npm test -- HingeConstrainedLegIKSolver.test.ts --run
```

Expected: PASS on "reaches a target directly below the hip with slight offset".

- [ ] **Step 7: Add more test coverage — unreachable, too-close, off-sagittal-plane**

Add these to the same `describe("position solve — reachable targets")` block (rename to `"position solve"`):

```typescript
it("handles unreachable target by stretching to max reach", () => {
  const chain = buildSyntheticLeg();
  // Target far below — unreachable, total leg length is 1.0
  const target = new Vector3(0, -1, 0);

  solver.solve({
    chain,
    footTarget: target,
    groundNormal: new Vector3(0, 1, 0),
    footForward: new Vector3(0, 0, 1),
    kneeHingeAxis: new Vector3(1, 0, 0),
    poleDirection: new Vector3(0, 0, 1),
    weight: 1,
  });

  const footWorld = getWorldPos(chain.effector);
  // Should be stretched toward target but not beyond maxReach (0.99)
  const hipWorld = getWorldPos(chain.root);
  expect(footWorld.distanceTo(hipWorld)).toBeLessThanOrEqual(0.99 + 1e-3);
  // Foot should be in the direction of target
  const dirToFoot = new Vector3().subVectors(footWorld, hipWorld).normalize();
  const dirToTarget = new Vector3().subVectors(target, hipWorld).normalize();
  expect(dirToFoot.dot(dirToTarget)).toBeGreaterThan(0.95);
});

it("handles too-close target by expanding to min reach", () => {
  const chain = buildSyntheticLeg();
  // Target at the hip itself — impossible, needs clamping
  const target = new Vector3(0, 1, 0);

  expect(() => {
    solver.solve({
      chain,
      footTarget: target,
      groundNormal: new Vector3(0, 1, 0),
      footForward: new Vector3(0, 0, 1),
      kneeHingeAxis: new Vector3(1, 0, 0),
      poleDirection: new Vector3(0, 0, 1),
      weight: 1,
    });
  }).not.toThrow();

  const footWorld = getWorldPos(chain.effector);
  // Should not contain NaN
  expect(Number.isFinite(footWorld.x)).toBe(true);
  expect(Number.isFinite(footWorld.y)).toBe(true);
  expect(Number.isFinite(footWorld.z)).toBe(true);
});

it("weight=0 leaves bones untouched", () => {
  const chain = buildSyntheticLeg();
  const origKneeQuat = chain.middle.quaternion.clone();
  const origHipQuat = chain.root.quaternion.clone();

  solver.solve({
    chain,
    footTarget: new Vector3(0, 0.2, 0.3),
    groundNormal: new Vector3(0, 1, 0),
    footForward: new Vector3(0, 0, 1),
    kneeHingeAxis: new Vector3(1, 0, 0),
    poleDirection: new Vector3(0, 0, 1),
    weight: 0,
  });

  expect(chain.middle.quaternion.equals(origKneeQuat)).toBe(true);
  expect(chain.root.quaternion.equals(origHipQuat)).toBe(true);
});
```

- [ ] **Step 8: Run all three new tests, expect all to pass**

```bash
npm test -- HingeConstrainedLegIKSolver.test.ts --run
```

Expected: all 4 tests pass. If the unreachable-target test fails, the clamping isn't right — revisit the `maxReach` clamp. If the too-close test throws NaN, check the `cosInterior` clamp to `[-1, 1]`.

- [ ] **Step 9: Commit**

```bash
git add src/lib/shared/3d/services/implementations/HingeConstrainedLegIKSolver.ts tests/unit/3d-animation/HingeConstrainedLegIKSolver.test.ts
git commit -m "feat(3d): HingeConstrainedLegIKSolver position solve with tests"
```

---

## Task 3: Foot rotation alignment pass

**Files:**
- Modify: `src/lib/shared/3d/services/implementations/HingeConstrainedLegIKSolver.ts`
- Modify: `tests/unit/3d-animation/HingeConstrainedLegIKSolver.test.ts`

After the position solve, the ankle inherits whatever world orientation it had from the chain rotations. But we want the foot's sole plane to align with the ground normal, and the toe to face `footForward`. This task adds a post-solve ankle rotation.

- [ ] **Step 1: Write the failing test**

Add to the same test file, after the position-solve block:

```typescript
describe("foot rotation alignment", () => {
  it("aligns foot forward vector with footForward input", () => {
    const chain = buildSyntheticLeg();
    // Give the foot a "rest forward" direction so the alignment has something to work with
    // In this synthetic rig, the foot's local +Z is its forward direction
    const target = new Vector3(0, 0.2, 0.3);
    const desiredForward = new Vector3(0, 0, 1); // character faces +Z

    solver.solve({
      chain,
      footTarget: target,
      groundNormal: new Vector3(0, 1, 0),
      footForward: desiredForward,
      kneeHingeAxis: new Vector3(1, 0, 0),
      poleDirection: new Vector3(0, 0, 1),
      weight: 1,
    });

    // Foot's world-space +Z axis should align with desiredForward
    const footWorldForward = new Vector3(0, 0, 1).applyQuaternion(
      chain.effector.getWorldQuaternion(new Quaternion())
    );
    // Check primarily Y-component — foot should be upright (not pointing down)
    // and dot with desiredForward should be positive (pointing in same hemisphere)
    expect(footWorldForward.dot(desiredForward)).toBeGreaterThan(0.7);
  });

  it("aligns foot sole with ground normal", () => {
    const chain = buildSyntheticLeg();
    const target = new Vector3(0, 0.2, 0.3);
    const groundNormal = new Vector3(0, 1, 0);

    solver.solve({
      chain,
      footTarget: target,
      groundNormal,
      footForward: new Vector3(0, 0, 1),
      kneeHingeAxis: new Vector3(1, 0, 0),
      poleDirection: new Vector3(0, 0, 1),
      weight: 1,
    });

    // Foot's world-space "up" (local +Y) should align with ground normal
    const footWorldUp = new Vector3(0, 1, 0).applyQuaternion(
      chain.effector.getWorldQuaternion(new Quaternion())
    );
    expect(footWorldUp.dot(groundNormal)).toBeGreaterThan(0.9);
  });
});
```

- [ ] **Step 2: Run the test, expect failure on `footWorldForward.dot(desiredForward)` because the solver doesn't touch the foot bone yet**

```bash
npm test -- HingeConstrainedLegIKSolver.test.ts --run
```

- [ ] **Step 3: Implement foot rotation alignment**

At the end of `solve()` in `HingeConstrainedLegIKSolver.ts`, before the weight blending block, add:

```typescript
// Foot rotation alignment: set the foot's world rotation such that
// the foot's local +Y axis points along groundNormal and the foot's
// local +Z axis points along footForward (with Gram-Schmidt to
// guarantee orthogonality).
{
  const up = input.groundNormal.clone().normalize();
  // Project footForward onto plane perpendicular to up
  const forward = input.footForward.clone();
  const forwardOnPlane = forward.sub(up.clone().multiplyScalar(forward.dot(up))).normalize();
  if (forwardOnPlane.lengthSq() < 1e-6) {
    // Degenerate: footForward parallel to up — skip alignment
  } else {
    const right = new Vector3().crossVectors(up, forwardOnPlane).normalize();
    // Build a rotation matrix from the three axes: right = X, up = Y, forward = Z
    const m = new (await import("three")).Matrix4();
    m.makeBasis(right, up, forwardOnPlane);
    const desiredWorldQuat = new Quaternion().setFromRotationMatrix(m);

    // Convert desired world quat to foot's local quat:
    // local = parent_world^-1 * desired_world
    const footParentWorldQuat = new Quaternion();
    if (foot.parent) {
      foot.parent.getWorldQuaternion(footParentWorldQuat);
    }
    foot.quaternion.copy(footParentWorldQuat.invert()).multiply(desiredWorldQuat);
    foot.updateMatrixWorld(true);
  }
}
```

**Note:** the `await import("three")` is wrong for a synchronous function — replace with a top-of-file import. Add `Matrix4` to the existing `import { Vector3, Quaternion }` line at the top of the file:

```typescript
import { Vector3, Quaternion, Matrix4 } from "three";
```

Then in the alignment block, use `new Matrix4()` directly without the dynamic import.

- [ ] **Step 4: Run tests, expect both new tests pass**

```bash
npm test -- HingeConstrainedLegIKSolver.test.ts --run
```

Expected: all 6 tests pass. If the "aligns foot forward" test fails, check that `forwardOnPlane` isn't being normalized to zero when `footForward` happens to be parallel to `groundNormal` (we already guard with `lengthSq() < 1e-6` but the synthetic rig might trigger it).

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/3d/services/implementations/HingeConstrainedLegIKSolver.ts tests/unit/3d-animation/HingeConstrainedLegIKSolver.test.ts
git commit -m "feat(3d): HingeConstrainedLegIKSolver foot rotation alignment"
```

---

## Task 4: Hinge axis calibration helper

**Files:**
- Create: `src/lib/shared/3d/services/implementations/KneeHingeAxisCalibrator.ts`
- Create: `tests/unit/3d-animation/KneeHingeAxisCalibrator.test.ts`

The `kneeHingeAxis` in `LegIKInput` must be derived from the skeleton's bind pose — different Mixamo models have slightly different UpLeg orientations, and we can't hard-code the axis. The calibration: compute the cross product of the UpLeg's rest direction and the Leg's rest direction. The result is perpendicular to the natural bend plane, which is exactly the hinge axis we want.

- [ ] **Step 1: Write the test**

```typescript
// tests/unit/3d-animation/KneeHingeAxisCalibrator.test.ts
import { describe, it, expect } from "vitest";
import { Vector3 } from "three";
import { KneeHingeAxisCalibrator } from "$lib/shared/3d/services/implementations/KneeHingeAxisCalibrator";

describe("KneeHingeAxisCalibrator", () => {
  const calibrator = new KneeHingeAxisCalibrator();

  it("returns +X for a leg bent in the YZ plane (knee bends forward)", () => {
    // UpLeg points down (-Y), Leg points slightly forward (-Y, +Z)
    // Natural bend plane = YZ plane → hinge axis = X
    const upLegRest = new Vector3(0, -1, 0).normalize();
    const legRest = new Vector3(0, -1, 0.1).normalize();

    const axis = calibrator.compute(upLegRest, legRest);

    expect(Math.abs(axis.x)).toBeGreaterThan(0.95);
    expect(Math.abs(axis.y)).toBeLessThan(0.1);
    expect(Math.abs(axis.z)).toBeLessThan(0.1);
  });

  it("returns unit-length result", () => {
    const upLegRest = new Vector3(0.1, -1, 0.05).normalize();
    const legRest = new Vector3(0, -1, 0.15).normalize();

    const axis = calibrator.compute(upLegRest, legRest);

    expect(axis.length()).toBeCloseTo(1, 4);
  });

  it("returns fallback axis when rest directions are parallel (degenerate)", () => {
    // Perfectly straight leg: both bones point down, cross product is zero
    const upLegRest = new Vector3(0, -1, 0);
    const legRest = new Vector3(0, -1, 0);

    const axis = calibrator.compute(upLegRest, legRest);

    // Should fall back to world X (sagittal for a character facing +Z)
    expect(axis.length()).toBeCloseTo(1, 4);
    expect(Math.abs(axis.x)).toBeGreaterThan(0.95);
  });
});
```

- [ ] **Step 2: Run test, expect module-not-found failure**

```bash
npm test -- KneeHingeAxisCalibrator.test.ts --run
```

- [ ] **Step 3: Implement the calibrator**

```typescript
// src/lib/shared/3d/services/implementations/KneeHingeAxisCalibrator.ts
import { Vector3 } from "three";

/**
 * Derives the knee's sagittal hinge axis from the rest-pose directions
 * of the UpLeg and Leg bones. The axis is the cross product of the
 * two rest directions, normalized. This is the axis perpendicular to
 * the natural bend plane — rotating around it bends the knee forward
 * or backward but never sideways.
 *
 * Fallback: if the two rest directions are nearly parallel (straight
 * leg in bind pose), returns world +X which is the sagittal axis for
 * a character facing +Z (the TKA scene convention).
 */
export class KneeHingeAxisCalibrator {
  compute(upLegRestDir: Vector3, legRestDir: Vector3): Vector3 {
    const axis = new Vector3().crossVectors(upLegRestDir, legRestDir);
    if (axis.lengthSq() < 1e-6) {
      return new Vector3(1, 0, 0);
    }
    return axis.normalize();
  }
}
```

- [ ] **Step 4: Run tests, expect all pass**

```bash
npm test -- KneeHingeAxisCalibrator.test.ts --run
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/3d/services/implementations/KneeHingeAxisCalibrator.ts tests/unit/3d-animation/KneeHingeAxisCalibrator.test.ts
git commit -m "feat(3d): KneeHingeAxisCalibrator derives sagittal axis from bind pose"
```

---

## Task 5: Contact curve data types and cache service

**Files:**
- Create: `src/lib/shared/3d/services/contracts/IContactCurveCache.ts`
- Create: `src/lib/shared/3d/services/implementations/ContactCurveCache.ts`
- Create: `tests/unit/3d-animation/ContactCurveCache.test.ts`

Contact curves are per-clip metadata: `{ leftFoot: number[], rightFoot: number[] }` sampled at the clip's native frame rate, where each value is `0` (airborne) to `1` (planted). Stored as JSON sidecars next to GLB files. The cache loads them lazily and answers `getContactAt(clipName, phase)` queries.

- [ ] **Step 1: Write the test**

```typescript
// tests/unit/3d-animation/ContactCurveCache.test.ts
import { describe, it, expect } from "vitest";
import { ContactCurveCache } from "$lib/shared/3d/services/implementations/ContactCurveCache";
import type { ContactCurveData } from "$lib/shared/3d/services/contracts/IContactCurveCache";

const testCurve: ContactCurveData = {
  clipName: "test-clip",
  frameRate: 30,
  frameCount: 4,
  leftFoot:  [1.0, 1.0, 0.0, 0.0],
  rightFoot: [0.0, 0.0, 1.0, 1.0],
};

describe("ContactCurveCache", () => {
  it("returns zero contact when no curve is registered", () => {
    const cache = new ContactCurveCache();
    const result = cache.getContactAt("unknown-clip", 0.5);
    expect(result.leftFoot).toBe(0);
    expect(result.rightFoot).toBe(0);
    expect(result.hasCurve).toBe(false);
  });

  it("samples the first frame at phase 0", () => {
    const cache = new ContactCurveCache();
    cache.register(testCurve);
    const result = cache.getContactAt("test-clip", 0);
    expect(result.leftFoot).toBeCloseTo(1.0);
    expect(result.rightFoot).toBeCloseTo(0.0);
    expect(result.hasCurve).toBe(true);
  });

  it("samples the last frame at phase 1", () => {
    const cache = new ContactCurveCache();
    cache.register(testCurve);
    const result = cache.getContactAt("test-clip", 1);
    expect(result.leftFoot).toBeCloseTo(0.0);
    expect(result.rightFoot).toBeCloseTo(1.0);
  });

  it("linearly interpolates between frames", () => {
    const cache = new ContactCurveCache();
    cache.register(testCurve);
    // Phase 0.5 = between frames 1 and 2 (0.5 * 3 = 1.5)
    // left:  frames [1.0, 1.0, 0.0, 0.0] → at index 1.5 → 0.5
    // right: frames [0.0, 0.0, 1.0, 1.0] → at index 1.5 → 0.5
    const result = cache.getContactAt("test-clip", 0.5);
    expect(result.leftFoot).toBeCloseTo(0.5, 3);
    expect(result.rightFoot).toBeCloseTo(0.5, 3);
  });

  it("clamps out-of-range phase", () => {
    const cache = new ContactCurveCache();
    cache.register(testCurve);
    const low = cache.getContactAt("test-clip", -0.5);
    const high = cache.getContactAt("test-clip", 1.5);
    expect(low.leftFoot).toBeCloseTo(1.0);
    expect(high.rightFoot).toBeCloseTo(1.0);
  });
});
```

- [ ] **Step 2: Run test, expect module-not-found failure**

```bash
npm test -- ContactCurveCache.test.ts --run
```

- [ ] **Step 3: Create the contract**

```typescript
// src/lib/shared/3d/services/contracts/IContactCurveCache.ts

/**
 * Per-frame foot contact state for a single animation clip.
 * Values are 0 (airborne) to 1 (fully planted). Intermediate values
 * represent blend ramps during transitions.
 */
export interface ContactCurveData {
  /** Matches the clip name in the GLB */
  clipName: string;
  /** Frames per second the curves are sampled at */
  frameRate: number;
  /** Total frame count (= clip duration × frameRate) */
  frameCount: number;
  /** Per-frame left foot contact (length === frameCount) */
  leftFoot: number[];
  /** Per-frame right foot contact (length === frameCount) */
  rightFoot: number[];
}

export interface ContactSample {
  /** Left foot contact value at the sampled phase, 0-1 */
  leftFoot: number;
  /** Right foot contact value at the sampled phase, 0-1 */
  rightFoot: number;
  /** Whether the queried clip has a registered curve.
   *  Consumers use this to fall back to velocity-based detection. */
  hasCurve: boolean;
}

export interface IContactCurveCache {
  /** Register a contact curve for a clip. Overwrites if already present. */
  register(data: ContactCurveData): void;

  /**
   * Sample the contact state for a clip at a given phase (0-1).
   * Out-of-range phases are clamped. Returns zero-contact with
   * hasCurve=false if no curve is registered for the clip.
   */
  getContactAt(clipName: string, phase: number): ContactSample;

  /** Check whether a clip has a registered curve. */
  has(clipName: string): boolean;

  /** Remove a clip's curve from the cache. */
  unregister(clipName: string): void;
}
```

- [ ] **Step 4: Create the implementation**

```typescript
// src/lib/shared/3d/services/implementations/ContactCurveCache.ts
import type {
  IContactCurveCache,
  ContactCurveData,
  ContactSample,
} from "../contracts/IContactCurveCache";

const EMPTY_SAMPLE: ContactSample = {
  leftFoot: 0,
  rightFoot: 0,
  hasCurve: false,
};

export class ContactCurveCache implements IContactCurveCache {
  private readonly curves = new Map<string, ContactCurveData>();

  register(data: ContactCurveData): void {
    if (data.leftFoot.length !== data.frameCount || data.rightFoot.length !== data.frameCount) {
      console.warn(
        `[ContactCurveCache] Curve "${data.clipName}" has mismatched frame counts — skipping`
      );
      return;
    }
    this.curves.set(data.clipName, data);
  }

  getContactAt(clipName: string, phase: number): ContactSample {
    const curve = this.curves.get(clipName);
    if (!curve) return EMPTY_SAMPLE;

    const clampedPhase = Math.max(0, Math.min(1, phase));
    const floatIndex = clampedPhase * (curve.frameCount - 1);
    const i0 = Math.floor(floatIndex);
    const i1 = Math.min(curve.frameCount - 1, i0 + 1);
    const t = floatIndex - i0;

    return {
      leftFoot: curve.leftFoot[i0] * (1 - t) + curve.leftFoot[i1] * t,
      rightFoot: curve.rightFoot[i0] * (1 - t) + curve.rightFoot[i1] * t,
      hasCurve: true,
    };
  }

  has(clipName: string): boolean {
    return this.curves.has(clipName);
  }

  unregister(clipName: string): void {
    this.curves.delete(clipName);
  }
}
```

- [ ] **Step 5: Run all tests, expect all pass**

```bash
npm test -- ContactCurveCache.test.ts --run
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/3d/services/contracts/IContactCurveCache.ts src/lib/shared/3d/services/implementations/ContactCurveCache.ts tests/unit/3d-animation/ContactCurveCache.test.ts
git commit -m "feat(3d): ContactCurveCache for authored foot planting metadata"
```

---

## Task 6: Swap `FootPlanter`'s solver + take the full 3-arg signature

**Files:**
- Modify: `src/lib/shared/3d/services/contracts/IFootPlanter.ts`
- Modify: `src/lib/shared/3d/services/implementations/FootPlanter.ts`
- Modify: `src/lib/shared/3d/components/Avatar3D.svelte` (callsite at ~line 380-381 and ~437)

`FootPlanter` currently calls `ikSolver.solveAndApply(chain, target)` in `applyFootIK()`. This task changes its dependency from `IIKSolver` to `ILegIKSolver`, adds a `IContactCurveCache` parameter to the initializer (stored but not yet consulted — Task 7 wires the behavior), captures hinge axes at init time, and updates the `Avatar3D.svelte` callsite so the whole project still type-checks after the commit.

**Note on sequencing:** Task 6 takes the final 3-arg `initialize()` signature upfront, even though `contactCurveCache` isn't used until Task 7. This keeps every commit type-safe. Task 7 only touches `updateContactPhase()` and `FootPlanterInput` — no contract or callsite changes.

- [ ] **Step 1: Update the contract**

In `src/lib/shared/3d/services/contracts/IFootPlanter.ts`, replace the imports and the `initialize` method signature:

```typescript
import type { LocomotionState } from "./IAnimationStateMachine";
import type { IAvatarSkeletonBuilder } from "./IAvatarSkeletonBuilder";
import type { ILegIKSolver } from "./ILegIKSolver";
import type { IContactCurveCache } from "./IContactCurveCache";
```

And the method:

```typescript
initialize(
  skeleton: IAvatarSkeletonBuilder,
  legIKSolver: ILegIKSolver,
  contactCurveCache: IContactCurveCache
): void;
```

Remove the old `IIKSolver` import from this file.

- [ ] **Step 2: Update `FootPlanter.ts` imports and fields**

Change the imports at the top:

```typescript
import { Vector3 } from "three";
import type {
  IFootPlanter,
  FootPlanterInput,
  FootPlanterConfig,
} from "../contracts/IFootPlanter";
import type { IAvatarSkeletonBuilder, BoneChain } from "../contracts/IAvatarSkeletonBuilder";
import type { ILegIKSolver, LegIKInput } from "../contracts/ILegIKSolver";
import type { IContactCurveCache } from "../contracts/IContactCurveCache";
import { LocomotionState } from "../contracts/IAnimationStateMachine";
import { KneeHingeAxisCalibrator } from "./KneeHingeAxisCalibrator";
```

Change the field `private ikSolver: IIKSolver | null = null;` to:

```typescript
private legIKSolver: ILegIKSolver | null = null;
private contactCurveCache: IContactCurveCache | null = null;
private leftKneeHingeAxis = new Vector3(1, 0, 0);
private rightKneeHingeAxis = new Vector3(1, 0, 0);
```

Remove the `kneePoleHint` field (no longer needed — `ILegIKSolver` takes `poleDirection` in its input).

Add a reusable pole direction:

```typescript
private readonly poleDirection = new Vector3(0, 0, 1);
```

- [ ] **Step 3: Update `initialize()` to capture hinge axes + cache**

Replace the existing `initialize()` method body with:

```typescript
initialize(
  skeleton: IAvatarSkeletonBuilder,
  legIKSolver: ILegIKSolver,
  contactCurveCache: IContactCurveCache
): void {
  this.skeleton = skeleton;
  this.legIKSolver = legIKSolver;
  this.contactCurveCache = contactCurveCache;
  this.leftLegChain = skeleton.getLeftLegChain();
  this.rightLegChain = skeleton.getRightLegChain();
  this.initialized = !!(this.leftLegChain && this.rightLegChain);

  if (!this.initialized) {
    console.warn("[FootPlanter] Leg chains not available — foot IK disabled");
    return;
  }

  // Derive per-leg hinge axes from bind-pose rest directions
  const calibrator = new KneeHingeAxisCalibrator();
  if (this.leftLegChain) {
    this.leftKneeHingeAxis.copy(
      calibrator.compute(this.leftLegChain.rootRestDir, this.leftLegChain.middleRestDir)
    );
  }
  if (this.rightLegChain) {
    this.rightKneeHingeAxis.copy(
      calibrator.compute(this.rightLegChain.rootRestDir, this.rightLegChain.middleRestDir)
    );
  }
}
```

- [ ] **Step 4: Rewrite `applyFootIK()` to call `ILegIKSolver`**

Replace the existing `applyFootIK()` method with:

```typescript
private applyFootIK(
  chain: BoneChain,
  foot: FootState,
  groundY: number,
  hingeAxis: Vector3
): void {
  if (foot.ikWeight < 0.001 || !this.legIKSolver) return;

  this.tempTarget.copy(foot.lockTarget);
  this.tempTarget.y = groundY + this.config.footHeightOffset;

  const input: LegIKInput = {
    chain,
    footTarget: this.tempTarget,
    groundNormal: new Vector3(0, 1, 0),
    footForward: this.poleDirection,
    kneeHingeAxis: hingeAxis,
    poleDirection: this.poleDirection,
    weight: foot.ikWeight,
  };

  this.legIKSolver.solve(input);

  // ILegIKSolver does its own weight blending, so no slerp here
  chain.root.updateMatrixWorld(true);
}
```

The weight blending loop that used to be in `FootPlanter` is now owned by `ILegIKSolver`, so delete the block that was saving `animRootQuat` / `animMiddleQuat` and slerping after the solve.

- [ ] **Step 5: Update the two `applyFootIK()` callsites**

In `update()`, change:

```typescript
this.applyFootIK(this.leftLegChain, this.leftFoot, input.groundY);
this.applyFootIK(this.rightLegChain, this.rightFoot, input.groundY);
```

To:

```typescript
this.applyFootIK(this.leftLegChain, this.leftFoot, input.groundY, this.leftKneeHingeAxis);
this.applyFootIK(this.rightLegChain, this.rightFoot, input.groundY, this.rightKneeHingeAxis);
```

- [ ] **Step 6: Update `dispose()`**

Add the new cache field to the reset block and rename the solver field:

```typescript
dispose(): void {
  this.skeleton = null;
  this.legIKSolver = null;
  this.contactCurveCache = null;
  this.leftLegChain = null;
  this.rightLegChain = null;
  this.initialized = false;
  this.firstFrame = true;
  this.leftFoot = createFootState();
  this.rightFoot = createFootState();
}
```

- [ ] **Step 7: Update the Avatar3D callsite**

Open `src/lib/shared/3d/components/Avatar3D.svelte`. Add these imports near the existing `FootPlanter` import (~line 52):

```typescript
import { HingeConstrainedLegIKSolver } from "../services/implementations/HingeConstrainedLegIKSolver";
import { ContactCurveCache } from "../services/implementations/ContactCurveCache";
```

Find the `footPlanter = new FootPlanter();` line (~437). Change it to also instantiate the new services:

```typescript
footPlanter = new FootPlanter();
const legIKSolver = new HingeConstrainedLegIKSolver();
const contactCurveCache = new ContactCurveCache();
```

Find the existing `footPlanter.initialize(skeletonService, ikSolver);` call (~line 381) and replace it with:

```typescript
if (enableLocomotion && footPlanter && skeletonService) {
  footPlanter.initialize(skeletonService, legIKSolver, contactCurveCache);
}
```

The enclosing `if` condition loses `&& ikSolver` because the new signature doesn't take the old generic solver. `enableLocomotion` remains the gate for now; Task 11 renames this to `enableFootPlanting`.

**Scope note:** `legIKSolver` and `contactCurveCache` are declared in the closure where `footPlanter` is created (~line 437). Make sure they're declared at a scope that's also visible from the `initialize()` call site (~line 381). If these lines are in different closures, hoist the `let legIKSolver: HingeConstrainedLegIKSolver | null = null;` declaration to the outer component scope alongside `let footPlanter: IFootPlanter | null = null;` at line 160, then assign inside the closure.

- [ ] **Step 8: Run type check across the whole project**

```bash
npm run check 2>&1 | grep -E "FootPlanter|IIKSolver|Avatar3D" | head -30
```

Expected: no errors referencing `FootPlanter.ts`, stale `IIKSolver` imports, or the `Avatar3D.svelte` callsite.

- [ ] **Step 9: Commit**

```bash
git add src/lib/shared/3d/services/contracts/IFootPlanter.ts src/lib/shared/3d/services/implementations/FootPlanter.ts src/lib/shared/3d/components/Avatar3D.svelte
git commit -m "refactor(3d): FootPlanter uses ILegIKSolver with contact curve cache"
```

---

## Task 7: Wire contact curve consultation into `updateContactPhase()`

**Files:**
- Modify: `src/lib/shared/3d/services/contracts/IFootPlanter.ts` (one interface extension)
- Modify: `src/lib/shared/3d/services/implementations/FootPlanter.ts`

Task 6 already swapped the solver, added the `contactCurveCache` field, and updated the Avatar3D callsite. This task fills in the behavior: `FootPlanterInput` gains `currentClipName` and `currentClipPhase` optional fields, and `updateContactPhase()` consults the cache when both are set. When the cache has a curve for the clip, the curve overrides the velocity heuristic. Otherwise velocity-based detection (existing behavior) applies.

Because the contract signature of `initialize()` was already made final in Task 6, no callsite updates are needed in this task.

- [ ] **Step 1: Add the two optional input fields**

In `src/lib/shared/3d/services/contracts/IFootPlanter.ts`, extend `FootPlanterInput`:

```typescript
export interface FootPlanterInput {
  /** World Y of the ground plane under the avatar */
  groundY: number;
  /** Current locomotion state (affects blending strategy) */
  locomotionState: LocomotionState;
  /** Whether the avatar is currently moving */
  isMoving: boolean;
  /** Name of the currently playing clip (for contact curve lookup).
   *  When undefined, FootPlanter falls back to velocity-based detection. */
  currentClipName?: string;
  /** Phase 0-1 through the current clip (for contact curve sampling).
   *  Only used when currentClipName is set and has a registered curve. */
  currentClipPhase?: number;
}
```

- [ ] **Step 2: Override `updateContactPhase()` when a curve exists**

Find the existing `updateContactPhase()` method. Before it runs the velocity threshold logic, check for a contact curve and use it if available.

Replace the existing `updateContactPhase()` signature and body with:

```typescript
private updateContactPhase(
  foot: FootState,
  currentPos: Vector3,
  input: FootPlanterInput,
  legChain: BoneChain,
  isLeftFoot: boolean
): void {
  // Contact curve path: if the current clip has authored curves, use them
  if (
    this.contactCurveCache &&
    input.currentClipName &&
    input.currentClipPhase !== undefined &&
    this.contactCurveCache.has(input.currentClipName)
  ) {
    const sample = this.contactCurveCache.getContactAt(
      input.currentClipName,
      input.currentClipPhase
    );
    const contactValue = isLeftFoot ? sample.leftFoot : sample.rightFoot;
    const shouldLock = contactValue > 0.5;

    if (shouldLock && !foot.isLocked) {
      foot.lockTarget.set(
        currentPos.x,
        input.groundY + this.config.footHeightOffset,
        currentPos.z
      );
      foot.isLocked = true;
    } else if (!shouldLock) {
      foot.isLocked = false;
    }
    return;
  }

  // Velocity fallback (existing behavior)
  const threshold = this.config.contactVelocityThreshold;
  if (foot.smoothedVelocity < threshold) {
    if (!foot.isLocked) {
      foot.lockTarget.set(
        currentPos.x,
        input.groundY + this.config.footHeightOffset,
        currentPos.z
      );
      foot.isLocked = true;
    } else {
      legChain.root.getWorldPosition(this.tempFootWorld);
      const dx = foot.lockTarget.x - this.tempFootWorld.x;
      const dy = foot.lockTarget.y - this.tempFootWorld.y;
      const dz = foot.lockTarget.z - this.tempFootWorld.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      const maxReach = legChain.totalLength * 0.95;
      if (distSq > maxReach * maxReach) {
        foot.isLocked = false;
      }
    }
  } else {
    foot.isLocked = false;
  }
}
```

- [ ] **Step 3: Update the two callsites in `update()`**

Change:

```typescript
this.updateContactPhase(this.leftFoot, leftFootPos, input, this.leftLegChain);
this.updateContactPhase(this.rightFoot, rightFootPos, input, this.rightLegChain);
```

To:

```typescript
this.updateContactPhase(this.leftFoot, leftFootPos, input, this.leftLegChain, true);
this.updateContactPhase(this.rightFoot, rightFootPos, input, this.rightLegChain, false);
```

- [ ] **Step 4: Run type check**

```bash
npm run check 2>&1 | grep -E "FootPlanter" | head -20
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/3d/services/contracts/IFootPlanter.ts src/lib/shared/3d/services/implementations/FootPlanter.ts
git commit -m "feat(3d): FootPlanter consults contact curves with velocity fallback"
```

---

## Task 8: Extend `RootMotionExtractor` with yaw delta

**Files:**
- Modify: `src/lib/shared/3d/services/contracts/IRootMotionExtractor.ts`
- Modify: `src/lib/shared/3d/services/implementations/RootMotionExtractor.ts`
- Create: `tests/unit/3d-animation/RootMotionExtractor-yaw.test.ts`

The `RootMotionExtractor` currently extracts X + forward translation from the Hips bone. This task adds yaw delta extraction: the frame-to-frame change in the Hips bone's rotation around the vertical axis. When turn clips are played in Phase 2, this will feed the rig's `rotation.y` so the body physically rotates through the turn.

**Mixamo coordinate note:** The existing extractor's comment explains that after Blender FBX→GLB conversion, the Hips bone's local `position.y` is "forward" and `position.z` is "absolute hip height." For rotation, the vertical axis (the one we rotate around for a yaw turn) is the **local Z axis** — not Y. This matters for correct yaw extraction.

- [ ] **Step 1: Write the test**

```typescript
// tests/unit/3d-animation/RootMotionExtractor-yaw.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { Bone, Euler } from "three";
import { RootMotionExtractor } from "$lib/shared/3d/services/implementations/RootMotionExtractor";

describe("RootMotionExtractor yaw delta", () => {
  let bone: Bone;
  let extractor: RootMotionExtractor;

  beforeEach(() => {
    bone = new Bone();
    bone.position.set(0, 0, -100); // Mixamo rest hip height
    bone.rotation.set(0, 0, 0);
    extractor = new RootMotionExtractor();
    extractor.initialize(bone);
  });

  it("returns zero yaw on first frame", () => {
    const delta = extractor.extract();
    expect(delta.yawDelta).toBe(0);
  });

  it("detects a yaw rotation applied to the Hips bone between frames", () => {
    // First frame — establish baseline
    extractor.extract();

    // Rotate bone 0.1 radians around the Mixamo-local vertical (Z)
    bone.rotation.z = 0.1;

    const delta = extractor.extract();
    expect(delta.yawDelta).toBeCloseTo(0.1, 3);
  });

  it("detects a negative yaw rotation", () => {
    extractor.extract();
    bone.rotation.z = -0.25;

    const delta = extractor.extract();
    expect(delta.yawDelta).toBeCloseTo(-0.25, 3);
  });

  it("clamps absurd yaw deltas (loop boundary)", () => {
    extractor.extract();
    // Simulate a clip loop: Hips snaps from end-of-clip to start
    bone.rotation.z = 3.0; // would be unrealistic frame-to-frame

    const delta = extractor.extract();
    // Should clamp — plan allows up to 0.5 rad/frame at 60fps (~30 rad/sec, very fast turn)
    expect(Math.abs(delta.yawDelta)).toBeLessThan(0.6);
  });
});
```

- [ ] **Step 2: Update the contract**

In `src/lib/shared/3d/services/contracts/IRootMotionExtractor.ts`, extend `RootMotionDelta`:

```typescript
export interface RootMotionDelta {
  /** Local-space lateral displacement this frame (left/right) */
  x: number;
  /** Local-space forward/backward displacement this frame.
   *  Positive = forward, negative = backward. */
  forward: number;
  /** Local-space yaw delta this frame in radians.
   *  Positive = counterclockwise (when viewed from above).
   *  Zero on first frame and on loop boundaries (clamped).
   *  Extracted from Hips bone rotation around the Mixamo local
   *  vertical axis, which is Z (not Y) after FBX→GLB conversion. */
  yawDelta: number;
}
```

- [ ] **Step 3: Run the test — expect failure because yawDelta doesn't exist on RootMotionDelta yet**

```bash
npm test -- RootMotionExtractor-yaw.test.ts --run
```

- [ ] **Step 4: Update `RootMotionExtractor.ts`**

Replace the `ZERO_DELTA` and the class body's rotation handling.

At the top of the file:

```typescript
const ZERO_DELTA: RootMotionDelta = { x: 0, forward: 0, yawDelta: 0 };
```

Add two new private fields to track the previous frame's yaw:

```typescript
private prevYaw = 0;
```

In `initialize()`, capture the rest yaw after the existing rest-position capture:

```typescript
initialize(hipsBone: Bone): void {
  this.hipsBone = hipsBone;
  this.hasPrevious = false;
  this.restX = hipsBone.position.x;
  this.restY = hipsBone.position.y;
  this.restZ = hipsBone.position.z;
  // Mixamo-local vertical axis is Z, so yaw lives in rotation.z
  this.prevYaw = hipsBone.rotation.z;
}
```

Replace the `extract()` method with a version that computes yawDelta. The full method:

```typescript
extract(): RootMotionDelta {
  if (!this.hipsBone) return ZERO_DELTA;

  const currentX = this.hipsBone.position.x;
  const currentY = this.hipsBone.position.y;
  const currentYaw = this.hipsBone.rotation.z;

  let delta: RootMotionDelta;

  if (!this.hasPrevious) {
    delta = { x: 0, forward: 0, yawDelta: 0 };
    this.hasPrevious = true;
  } else {
    const rawYawDelta = currentYaw - this.prevYaw;
    // Clamp absurd deltas (loop boundary) — same pattern as translation
    const MAX_YAW_PER_FRAME = 0.5; // radians; fast turn is ~π in 0.5s → 0.1 rad/frame at 60fps
    const yawDelta = Math.abs(rawYawDelta) > MAX_YAW_PER_FRAME ? 0 : rawYawDelta;

    delta = {
      x: currentX - this.prevX,
      forward: currentY - this.prevY,
      yawDelta,
    };

    const MAX_FRAME_DELTA = 15;
    if (Math.abs(delta.x) > MAX_FRAME_DELTA || Math.abs(delta.forward) > MAX_FRAME_DELTA) {
      delta = { x: 0, forward: 0, yawDelta: delta.yawDelta };
    }
  }

  this.prevX = currentX;
  this.prevY = currentY;
  this.prevYaw = currentYaw;

  // Restore Hips XY to rest (zero out translation displacement).
  // Note: rotation.z is NOT restored — the clip's yaw curve drives the
  // authored rotation, and consumers integrate the delta into the rig.
  this.hipsBone.position.x = this.restX;
  this.hipsBone.position.y = this.restY;

  return delta;
}
```

Update `reset()` to also reset prevYaw:

```typescript
reset(): void {
  this.hasPrevious = false;
  this.prevX = 0;
  this.prevY = 0;
  this.prevYaw = 0;
}
```

- [ ] **Step 5: Run the test, expect all pass**

```bash
npm test -- RootMotionExtractor-yaw.test.ts --run
```

If the "clamps absurd yaw deltas" test fails because the clamp threshold is too tight, bump `MAX_YAW_PER_FRAME` up to `0.6`. If the "detects yaw rotation" test is off, verify the existing `prevYaw` initialization in `initialize()` captures the rest rotation before any animation plays.

- [ ] **Step 6: Run any existing RootMotionExtractor tests to verify no regressions**

```bash
npm test -- RootMotionExtractor --run
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/shared/3d/services/contracts/IRootMotionExtractor.ts src/lib/shared/3d/services/implementations/RootMotionExtractor.ts tests/unit/3d-animation/RootMotionExtractor-yaw.test.ts
git commit -m "feat(3d): RootMotionExtractor emits yaw delta from Hips rotation"
```

---

## Task 9: Avatar3D propagates `yawDelta` through `onRootMotion`

**Files:**
- Modify: `src/lib/shared/3d/components/Avatar3D.svelte:726-743`

The existing `Avatar3D.svelte` animate loop reads `localDelta = rootMotionExtractor.extract()` and emits `onRootMotion({ x, z })`. With `RootMotionDelta` now having a `yawDelta` field, the callback signature needs to include it so upstream consumers (PerformerRig) can integrate yaw.

- [ ] **Step 1: Locate the existing root motion block**

Open `src/lib/shared/3d/components/Avatar3D.svelte` and find line ~726-743 — the block that starts with `if (rootMotionExtractor?.isReady() && onRootMotion)`.

- [ ] **Step 2: Update the `onRootMotion` prop type**

Find the props block near the top of the file (search for `enableRootMotion` to locate it) and find the `onRootMotion` callback type declaration. Update it from:

```typescript
onRootMotion?: (delta: { x: number; z: number }) => void;
```

To:

```typescript
onRootMotion?: (delta: { x: number; z: number; yawDelta: number }) => void;
```

- [ ] **Step 3: Update the emission**

Replace the block at `Avatar3D.svelte:726-743` with:

```typescript
if (rootMotionExtractor?.isReady() && onRootMotion) {
  const localDelta = rootMotionExtractor.extract();
  if (localDelta.x !== 0 || localDelta.forward !== 0 || localDelta.yawDelta !== 0) {
    const cmToScene = avatarHeight / 170;
    const dx = localDelta.x * cmToScene;
    const df = localDelta.forward * cmToScene;

    const cos = Math.cos(facingAngle);
    const sin = Math.sin(facingAngle);
    onRootMotion({
      x: dx * cos + df * sin,
      z: -dx * sin + df * cos,
      yawDelta: localDelta.yawDelta,
    });
  }
}
```

The yaw delta is in local space (Mixamo-local Z), but the rig's `rotation.y` is in scene space (Three.js Y-up). For a standing avatar, the Mixamo local Z IS the scene world Y (after the Blender conversion rotated the skeleton upright), so the delta can be passed through as-is. The consumer (PerformerRig) adds it to `rotation.y`.

- [ ] **Step 4: Type-check the file**

```bash
npm run check 2>&1 | grep -E "Avatar3D" | head -20
```

Expected: no new errors. If TypeScript complains about `onRootMotion` callsites in upstream components, those are addressed in Task 10.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/3d/components/Avatar3D.svelte
git commit -m "feat(3d): Avatar3D propagates yawDelta through onRootMotion callback"
```

---

## Task 10: PerformerRig integrates `yawDelta` when active-turn flag is set

**Files:**
- Modify: `src/lib/shared/3d/components/PerformerRig.svelte`

PerformerRig owns the `rotation.y = facingAngle` binding. When a turn is in progress, the turn clip's `yawDelta` should accumulate into the rig's rotation each frame. When no turn is active, `yawDelta` is ignored and the rig stays at whatever `facingAngle` its consumer assigns directly.

For Phase 1, we add the wiring behind a flag. Phase 2 will set the flag when a turn clip starts playing.

- [ ] **Step 1: Add the new prop and yaw handler**

Open `src/lib/shared/3d/components/PerformerRig.svelte`. Find the props block (look for `facingAngle: number;`). Add two new optional props:

```typescript
interface Props {
  // ... existing props
  facingAngle: number;
  /** When true, facingAngle is driven by root motion yawDelta from
   *  the animation clip. When false, facingAngle is authoritative
   *  (consumer-driven). Default false. */
  animationDrivenYaw?: boolean;
  /** Callback fired when yaw has been integrated — lets the consumer
   *  read back the updated angle. Only fires when animationDrivenYaw
   *  is true and a non-zero delta was applied. */
  onYawIntegrated?: (newAngle: number) => void;
}
```

- [ ] **Step 2: Add an internal yaw accumulator**

Near the top of the component's `<script>` block, add:

```typescript
// When animation-driven yaw is active, this mirrors the consumer's
// facingAngle but is updated from root motion deltas each frame.
let accumulatedYaw = $state(facingAngle);

// Sync to consumer's facingAngle when it changes externally
$effect(() => {
  if (!animationDrivenYaw) {
    accumulatedYaw = facingAngle;
  }
});
```

- [ ] **Step 3: Handle the onRootMotion callback from Avatar3D**

Find where `<Avatar3D>` is rendered inside `PerformerRig.svelte`. It probably already has some props being passed — look for `facingAngle={0}` or similar (the spec noted line 157). Add an `onRootMotion` handler that integrates yawDelta when the flag is set:

```svelte
<Avatar3D
  {...existingProps}
  onRootMotion={animationDrivenYaw
    ? (delta) => {
        if (delta.yawDelta !== 0) {
          accumulatedYaw += delta.yawDelta;
          onYawIntegrated?.(accumulatedYaw);
        }
      }
    : undefined}
/>
```

- [ ] **Step 4: Bind the group's rotation.y to the active yaw source**

Find the existing `rotation.y={facingAngle}` on the T.Group (spec noted line 147). Change it to:

```svelte
<T.Group
  position={[x, groundOffset, z]}
  rotation.y={animationDrivenYaw ? accumulatedYaw : facingAngle}
>
```

- [ ] **Step 5: Type-check**

```bash
npm run check 2>&1 | grep -E "PerformerRig" | head -20
```

Expected: no errors. If Svelte complains about `$effect` usage, double-check that the component is using Svelte 5 runes (it should be — the project-wide convention).

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/3d/components/PerformerRig.svelte
git commit -m "feat(3d): PerformerRig integrates yawDelta when animationDrivenYaw is true"
```

---

## Task 11: Re-enable FootPlanter in Avatar3D behind a prop flag

**Files:**
- Modify: `src/lib/shared/3d/components/Avatar3D.svelte`

Task 6 already updated the callsite and imports. This task adds the `enableFootPlanting` prop, flips the gate from the generic `enableLocomotion` to the new opt-in flag, and replaces the disabled-block comment at `Avatar3D.svelte:746-752` with the real `footPlanter.update()` call.

- [ ] **Step 1: Add the prop**

In the `Props` interface in `Avatar3D.svelte`, add:

```typescript
/** When true, FootPlanter runs after LocomotionAnimator to pin feet
 *  to the ground. Required for the sequence viewer performer and
 *  standing museum NPCs. Leave false for the museum FPS player,
 *  which prefers code-driven responsive movement. Default false. */
enableFootPlanting?: boolean;
```

Destructure it in the `let { ... } = $props();` block with a default of `false`.

- [ ] **Step 2: Rename the init gate**

Find the `if (enableLocomotion && footPlanter && skeletonService)` block that was updated in Task 6. Change it to:

```typescript
if (enableFootPlanting && footPlanter && skeletonService) {
  footPlanter.initialize(skeletonService, legIKSolver, contactCurveCache);
}
```

Only the flag name changes — the three-arg initialization body from Task 6 stays the same.

- [ ] **Step 3: Replace the disabled-block comment with the actual call**

At `Avatar3D.svelte:746-752`, replace the entire disabled-explanation comment and the empty block with:

```typescript
// Foot planting IK — pins feet to the ground during contact phases.
// Uses HingeConstrainedLegIKSolver (1-DOF knee) and consults contact
// curves for clips that have them (fall back to velocity detection).
if (enableFootPlanting && footPlanter?.isReady()) {
  footPlanter.update(delta, {
    groundY: 0, // Rig-local ground is y=0; PerformerRig handles world offset
    locomotionState: currentLocomotionState,
    isMoving,
    // currentClipName and currentClipPhase omitted in Phase 1 —
    // velocity fallback handles idle + walk. Phase 2 populates
    // these when turn clips play.
  });
}
```

**Variable resolution:** `currentLocomotionState` should be the state variable the existing state machine writes to. Search for `stateOutput.state` in the animate loop — the state is assigned there. If it's not exposed at the scope where FootPlanter runs, hoist it (add `let currentLocomotionState = LocomotionState.IDLE;` near the other let declarations, and assign `currentLocomotionState = stateOutput.state;` inside the state machine branch).

- [ ] **Step 4: Verify the dev server compiles**

```bash
curl -s http://localhost:5173/ > /dev/null 2>&1
npm run check 2>&1 | grep -E "Avatar3D" | head -20
```

Expected: `npm run check` shows no new errors. The dev server should hot-reload; if the user is running it, check the browser console.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/3d/components/Avatar3D.svelte
git commit -m "feat(3d): re-enable FootPlanter in Avatar3D behind enableFootPlanting flag"
```

---

## Task 12: Update stale root-motion memory

**Files:**
- Modify: `C:/Users/Austen/.claude/projects/E--tka-platform/memory/project_root_motion_migration.md`

The existing memory file claims root motion is "built but disabled." Investigation during brainstorming showed this is incorrect: `rootMotionExtractor.extract()` is live in the animate loop at `Avatar3D.svelte:726-743`, and the consumer-side `onRootMotion` callback is the actual gate. Update the memory to reflect reality.

- [ ] **Step 1: Read the current memory file**

```bash
cat C:/Users/Austen/.claude/projects/E--tka-platform/memory/project_root_motion_migration.md
```

- [ ] **Step 2: Replace the file contents**

Rewrite the memory to reflect the true state:

```markdown
---
name: Root motion migration
description: Root motion extractor is live in Avatar3D; consumer-side yaw integration was added as part of the turn-in-place project
type: project
---

Root motion is **live and running**, not disabled as a previous memory claimed. `RootMotionExtractor.extract()` is called every frame in `Avatar3D.svelte` animate loop and emits `onRootMotion({x, z, yawDelta})` when the callback is provided. Whether the consumer acts on the delta is the actual gate.

**Current state (post Phase 1 of turn-in-place animation):**
- XZ translation deltas: live since 2026-04-04 build
- Yaw delta: added 2026-04-11 as part of `2026-04-11-turn-in-place-phase-1-foundation.md`
- Hips XY is zero-restored after extraction; Hips Z (vertical bob) is preserved
- Mixamo coordinate mapping: local `position.y` = forward, local `position.z` = hip height, local `rotation.z` = yaw
- Consumer-side yaw integration in `PerformerRig` is gated on the `animationDrivenYaw` prop — false for the FPS player (unchanged responsive code-driven movement), true for turn-clip contexts

**How to apply:** Root motion is not a global flag. Turn on its consumer side (pass `onRootMotion` callback + set `animationDrivenYaw={true}` on PerformerRig) only for avatars that should have animation drive their world motion. The museum FPS player intentionally does not.

**Pipeline position in Avatar3D.svelte:**
- `Avatar3D.svelte:726-743` — extractor call, cm→scene conversion, onRootMotion emission
- `LocomotionAnimator.update()` → writes Hips transforms from clip
- `rootMotionExtractor.extract()` → reads delta, zero-restores XY
- `FootPlanter.update()` → post-process foot IK (re-enabled in Phase 1 behind `enableFootPlanting` flag)
- `AvatarAnimator.update()` → arm IK for props
```

Write the content with the `Write` tool.

- [ ] **Step 3: No commit — memory files live outside the repo**

The memory directory is under `~/.claude/projects/` and is not version-controlled with the project. No git commit needed.

---

## Task 13: Manual verification

**Files:** none — checklist only.

Phase 1 is foundation work. The user-visible change is that FootPlanter is now enabled for any Avatar3D that opts in via `enableFootPlanting={true}`. In Phase 1 we do not yet enable it anywhere by default — Phase 2 does that as part of the turn-clip wiring. Verification is therefore limited to: unit tests pass, type checker is clean, no regressions in existing viewer contexts.

- [ ] **Step 1: Run the full test suite**

```bash
npm test --run
```

Expected: all Phase 1 tests pass (6 in HingeConstrainedLegIKSolver, 3 in KneeHingeAxisCalibrator, 5 in ContactCurveCache, 4 in RootMotionExtractor-yaw); all previously-passing tests still pass.

- [ ] **Step 2: Type check the full project**

```bash
npm run check 2>&1 | tail -30
```

Expected: no new errors. Pre-existing warnings may persist.

- [ ] **Step 3: Verify no regression in the running sequence viewer**

Ask the user to reload the sequence viewer and play a short sequence. Because `enableFootPlanting` defaults to `false` and no consumer passes `true` yet, behavior should be identical to before this phase. The user should see **no visual change** in the viewer yet — that's correct, and it's the confirmation that Phase 1 is cleanly gated.

Message template to send to the user:

> Phase 1 foundation is committed. Nothing visually changes yet — `enableFootPlanting` defaults off and no component passes `true`. Please reload the sequence viewer and play a short sequence to confirm nothing looks different or broken. The visual improvements land in Phase 2 when we wire in the turn clips and set the flag to true.

- [ ] **Step 4: Announce completion**

Once user confirms no regression, Phase 1 is done. Phase 2 is the next plan — it builds the turn clip library, `ITurnAnimator` interface, schedulers, and flips `enableFootPlanting` on.

---

## Self-review checklist (for the plan author, before handoff)

- [x] Every task has exact file paths
- [x] TDD steps show actual test code and actual implementation code
- [x] Every task ends with a commit step
- [x] No "TBD", "TODO", "fill in details" placeholders
- [x] Type signatures are consistent across tasks (e.g., `FootPlanter.initialize()` signature updated in Tasks 6, 7, 11 — same shape each time)
- [x] Spec coverage: every Phase 1 task from the spec maps to a task here
  - Hinge-constrained knee solver → Task 2
  - Foot rotation alignment → Task 3
  - Contact curves → Tasks 5, 7
  - FootPlanter solver swap → Task 6
  - FootPlanter re-enable → Task 11
  - RootMotionExtractor yaw → Task 8
  - Yaw consumption in rig → Tasks 9, 10
  - Stale memory fix → Task 12
- [x] Hinge axis calibration added (Task 4) — spec calls for deriving from bind pose
- [x] Every new file has a corresponding test except pure type definitions and component wiring
- [x] Existing files modified with exact line number references where the spec mentioned them
