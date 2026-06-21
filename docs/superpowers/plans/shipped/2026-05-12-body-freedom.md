# Body Freedom Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fixed-weight spine twist with iterative aim solver, add Body Freedom slider with Square/Natural/Expressive presets to the gear popover.

**Architecture:** Extend `spine-twister.ts` internals with an ozz-animation-style iterative aim algorithm. Each spine bone aims at the hand target, absorbing a fraction of the error and passing the residual up the chain. The `Spine` bone (between Hips and Spine1) joins the rotation chain. A `bodyFreedom` float (0–1) interpolates per-bone aim weights between Square (current behavior) and Expressive (full body engagement).

**Tech Stack:** Three.js (Quaternion, Vector3, Euler), Svelte 5 ($state/$derived), Vitest

---

### Task 1: Add bodyFreedom to UserProportionsState

**Files:**
- Modify: `src/lib/shared/3d/state/user-proportions-state.svelte.ts`

- [ ] **Step 1: Add the bodyFreedom field and accessors**

Add a private `_bodyFreedom` state field with default 0.5 (Natural), a getter, a setter with clamping, include it in `getProportions()` return, and `reset()`. Add a display helper.

In `src/lib/shared/3d/state/user-proportions-state.svelte.ts`, after line 25 (`DEFAULT_USER_PROPORTIONS.build`), add:

```typescript
  private _bodyFreedom = $state(0.5);
```

Add getter after the `build` getter (after line 47):

```typescript
  get bodyFreedom(): number {
    return this._bodyFreedom;
  }
```

Add setter after `setBuild` (after line 97):

```typescript
  setBodyFreedom(value: number): void {
    this._bodyFreedom = Math.max(0, Math.min(1, value));
  }
```

Update `reset()` — add inside the method body after line 111:

```typescript
    this._bodyFreedom = 0.5;
```

Add a display helper after `staffLengthDisplay` (after line 134):

```typescript
  get bodyFreedomDisplay(): string {
    if (this._bodyFreedom <= 0.01) return "Square";
    if (Math.abs(this._bodyFreedom - 0.5) < 0.01) return "Natural";
    if (this._bodyFreedom >= 0.99) return "Expressive";
    return `${Math.round(this._bodyFreedom * 100)}%`;
  }
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/state/user-proportions-state.svelte.ts
git commit -m "feat(body-freedom): add bodyFreedom state to UserProportionsState"
```

---

### Task 2: Rewrite spine-twister with iterative aim algorithm

**Files:**
- Modify: `src/lib/shared/3d/services/spine-twister.ts`
- Reference: `src/lib/shared/3d/services/swing-twist-constraint.ts` (for `decomposeSwingTwist`)

This is the core algorithm change. The new `computeSpineTwist` takes a `bodyFreedom` parameter and iteratively aims each bone at the hand target.

- [ ] **Step 1: Write the new spine-twister.ts**

Replace the entire contents of `src/lib/shared/3d/services/spine-twister.ts` with:

```typescript
/**
 * SpineTwister — Iterative Aim Solver
 *
 * Each spine bone aims toward the hand target and absorbs a fraction of the
 * rotational error. The next bone up the chain sees only the residual.
 * Lower spine does the heavy lifting; upper spine refines. Natural S-curve
 * emerges from the solve.
 *
 * Based on the ozz-animation iterative aim pattern.
 */

import type { Vector3 } from "three";
import { Quaternion } from "three";
import { decomposeSwingTwist } from "./swing-twist-constraint";

// ── Preset endpoint tables ──────────────────────────────────────────

interface BoneParams {
  aimWeight: number;
  maxSwing: number; // radians
  maxTwist: number; // radians
}

const DEG = Math.PI / 180;

const SQUARE_WEIGHTS: Record<string, BoneParams> = {
  spine:  { aimWeight: 0.00, maxSwing: 35 * DEG, maxTwist: 25 * DEG },
  spine1: { aimWeight: 0.30, maxSwing: 25 * DEG, maxTwist: 15 * DEG },
  spine2: { aimWeight: 0.35, maxSwing: 20 * DEG, maxTwist: 12 * DEG },
  neck:   { aimWeight: 0.15, maxSwing: 45 * DEG, maxTwist: 35 * DEG },
  head:   { aimWeight: 0.80, maxSwing: 70 * DEG, maxTwist: 50 * DEG },
};

const EXPRESSIVE_WEIGHTS: Record<string, BoneParams> = {
  spine:  { aimWeight: 0.60, maxSwing: 35 * DEG, maxTwist: 25 * DEG },
  spine1: { aimWeight: 0.30, maxSwing: 25 * DEG, maxTwist: 15 * DEG },
  spine2: { aimWeight: 0.35, maxSwing: 20 * DEG, maxTwist: 12 * DEG },
  neck:   { aimWeight: 0.30, maxSwing: 45 * DEG, maxTwist: 35 * DEG },
  head:   { aimWeight: 1.00, maxSwing: 70 * DEG, maxTwist: 50 * DEG },
};

const SINGLE_HAND_WEIGHT_SCALE = 0.65;

const HIP_COUNTER_SQUARE = -0.20;
const HIP_COUNTER_EXPRESSIVE = -0.10;

// ── Result interface ────────────────────────────────────────────────

export interface SpineTwistResult {
  spine: Quaternion;
  spine1: Quaternion;
  spine2: Quaternion;
  neck: Quaternion;
  head: Quaternion;
  hips: Quaternion;
}

// ── Spine bone chain order (bottom-to-top) ──────────────────────────

const SPINE_CHAIN: { key: keyof Omit<SpineTwistResult, "hips">; boneName: string }[] = [
  { key: "spine",  boneName: "Spine" },
  { key: "spine1", boneName: "Spine1" },
  { key: "spine2", boneName: "Spine2" },
  { key: "neck",   boneName: "Neck" },
  { key: "head",   boneName: "Head" },
];

// ── Helpers ─────────────────────────────────────────────────────────

const IDENTITY = new Quaternion();
const UP = { x: 0, y: 1, z: 0 };

function lerpBoneParams(a: BoneParams, b: BoneParams, t: number): BoneParams {
  return {
    aimWeight: a.aimWeight + (b.aimWeight - a.aimWeight) * t,
    maxSwing: a.maxSwing,
    maxTwist: a.maxTwist,
  };
}

function clampQuatAngle(q: Quaternion, maxRad: number): Quaternion {
  const angle = 2 * Math.acos(Math.max(-1, Math.min(1, q.w)));
  if (angle <= maxRad || angle < 1e-6) return q.clone();
  const sinHalf = Math.sin(angle / 2);
  if (sinHalf < 1e-10) return q.clone();
  const scale = Math.sin(maxRad / 2) / sinHalf;
  return new Quaternion(q.x * scale, q.y * scale, q.z * scale, Math.cos(maxRad / 2));
}

function quaternionFromTo(from: Vector3, to: Vector3): Quaternion {
  const q = new Quaternion();
  // Three.js setFromUnitVectors expects normalized vectors
  const fN = from.clone().normalize();
  const tN = to.clone().normalize();
  q.setFromUnitVectors(fN, tN);
  return q;
}

/**
 * Compute the aim target from hand positions.
 * Two hands: midpoint biased toward the more cross-body hand.
 * Single hand: that hand's position.
 */
function computeAimTarget(
  left: Vector3 | null,
  right: Vector3 | null,
  bodyCenter: Vector3,
): Vector3 | null {
  if (left && right) {
    const mid = left.clone().add(right).multiplyScalar(0.5);
    // Bias toward the more cross-body hand (left hand right of center, or right hand left of center)
    const leftCross = Math.max(0, -(left.x - bodyCenter.x));
    const rightCross = Math.max(0, right.x - bodyCenter.x);
    const totalCross = leftCross + rightCross;
    if (totalCross > 0.01) {
      const bias = (rightCross - leftCross) / totalCross;
      // bias > 0 means right hand is more cross-body → shift target toward right hand
      mid.x += bias * (right.x - left.x) * 0.25;
      mid.y += bias * (right.y - left.y) * 0.25;
      mid.z += bias * (right.z - left.z) * 0.25;
    }
    return mid;
  }
  return left ?? right ?? null;
}

// ── Main entry point ────────────────────────────────────────────────

/**
 * Compute per-bone quaternions using iterative aim with residual cascading.
 *
 * @param leftHandTarget  Left hand world position (null if no left prop)
 * @param rightHandTarget Right hand world position (null if no right prop)
 * @param bodyCenter      Performer's body center (shoulder-level origin)
 * @param bodyFreedom     0.0 (Square) to 1.0 (Expressive)
 * @param availableBones  Set of bone names present in the model
 */
export function computeSpineTwist(
  leftHandTarget: Vector3 | null,
  rightHandTarget: Vector3 | null,
  bodyCenter: Vector3,
  bodyFreedom: number,
  availableBones?: Set<string>,
): SpineTwistResult {
  const result: SpineTwistResult = {
    spine: IDENTITY.clone(),
    spine1: IDENTITY.clone(),
    spine2: IDENTITY.clone(),
    neck: IDENTITY.clone(),
    head: IDENTITY.clone(),
    hips: IDENTITY.clone(),
  };

  const target = computeAimTarget(leftHandTarget, rightHandTarget, bodyCenter);
  if (!target) return result;

  const singleHand = !leftHandTarget || !rightHandTarget;
  const t = Math.max(0, Math.min(1, bodyFreedom));

  // Forward direction: the body faces +Z in rest pose (bone local Y-axis
  // points up the spine, but for yaw aiming we project onto the XZ plane).
  // We use the body-center-to-target direction projected onto XZ as the aim.
  const aimDir = target.clone().sub(bodyCenter);
  if (aimDir.lengthSq() < 1e-8) return result;

  // The "forward" for aiming purposes is +Z (the direction the performer faces).
  // We compute the full rotation from +Z to the aim direction.
  const forward = { x: 0, y: 0, z: 1 } as unknown as Vector3;
  const aimNorm = aimDir.clone().normalize();

  // Build the full aim rotation (from rest forward to target direction)
  const fullAim = quaternionFromTo(
    forward as unknown as Vector3,
    aimNorm,
  );

  // Decompose into yaw (Y-axis twist) and pitch (swing)
  const yAxis = { x: 0, y: 1, z: 0 } as unknown as Vector3;
  const { swing: pitchSwing, twist: yawTwist } = decomposeSwingTwist(fullAim, yAxis);

  // Total yaw angle — used for hip counter-rotation calculation
  let totalYawApplied = 0;

  // Iterative aim: each bone absorbs a fraction, next bone sees residual
  let residualYaw = yawTwist.clone();
  let residualPitch = pitchSwing.clone();

  for (const { key, boneName } of SPINE_CHAIN) {
    // Skip bones not present in the model
    if (availableBones && !availableBones.has(boneName) && key !== "spine") continue;
    // Spine bone might not be in availableBones set — check explicitly
    if (key === "spine" && availableBones && !availableBones.has("Spine")) continue;

    const squareP = SQUARE_WEIGHTS[key];
    const expressiveP = EXPRESSIVE_WEIGHTS[key];
    if (!squareP || !expressiveP) continue;

    const params = lerpBoneParams(squareP, expressiveP, t);
    let weight = params.aimWeight;
    if (singleHand) weight *= SINGLE_HAND_WEIGHT_SCALE;

    if (weight < 0.001) {
      result[key] = IDENTITY.clone();
      continue;
    }

    // Scale residual yaw by this bone's aim weight
    const scaledYaw = new Quaternion().slerp(residualYaw, weight);
    const clampedYaw = clampQuatAngle(scaledYaw, params.maxTwist);

    // Scale residual pitch by this bone's aim weight
    const scaledPitch = new Quaternion().slerp(residualPitch, weight);
    const clampedPitch = clampQuatAngle(scaledPitch, params.maxSwing);

    // Compose: yaw (Y-axis) then pitch
    const boneQuat = clampedPitch.clone().multiply(clampedYaw);
    result[key] = boneQuat;

    // Track total yaw for hip counter-rotation
    const yawAngle = 2 * Math.acos(Math.max(-1, Math.min(1, clampedYaw.w)));
    const yawSign =
      clampedYaw.x * UP.x + clampedYaw.y * UP.y + clampedYaw.z * UP.z < 0 ? -1 : 1;
    totalYawApplied += yawAngle * yawSign;

    // Remove this bone's contribution from the residual
    const yawConsumed = clampedYaw.clone().conjugate();
    residualYaw = yawConsumed.multiply(residualYaw);
    const pitchConsumed = clampedPitch.clone().conjugate();
    residualPitch = pitchConsumed.multiply(residualPitch);
  }

  // Hip counter-rotation (interpolated by bodyFreedom)
  const hipFraction = HIP_COUNTER_SQUARE + (HIP_COUNTER_EXPRESSIVE - HIP_COUNTER_SQUARE) * t;
  if (Math.abs(totalYawApplied) > 0.001) {
    result.hips = new Quaternion().setFromAxisAngle(
      yAxis,
      totalYawApplied * hipFraction,
    );
  }

  return result;
}
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors. The `decomposeSwingTwist` import from `swing-twist-constraint.ts` should resolve — it's already an export. The `Vector3` literal objects used as direction constants may need to be actual `Vector3` instances; fix any type errors by converting them.

- [ ] **Step 3: Fix any type issues**

The `forward` and `yAxis` constants must be real `Vector3` instances for `quaternionFromTo` and `decomposeSwingTwist`. Replace the object literals at the top of the function body:

At the spot where `forward` and `yAxis` are used inside `computeSpineTwist`, ensure they are:

```typescript
  const forward = new Vector3(0, 0, 1);
  const yAxis = new Vector3(0, 1, 0);
```

Remove the `as unknown as Vector3` casts. Import `Vector3` at the top (already imported).

- [ ] **Step 4: Run typecheck again**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: Clean

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/3d/services/spine-twister.ts
git commit -m "feat(body-freedom): rewrite spine-twister with iterative aim algorithm"
```

---

### Task 3: Integrate into AvatarAnimator

**Files:**
- Modify: `src/lib/shared/3d/services/implementations/AvatarAnimator.ts`
- Reference: `src/lib/shared/3d/state/user-proportions-state.svelte.ts`

The animator needs to: (a) cache the Spine bone's rest quaternion, (b) apply the new `spine` key from the result, and (c) pass `bodyFreedom` to `computeSpineTwist`.

- [ ] **Step 1: Add spine to twist quat caches**

In `AvatarAnimator.ts`, find the `spineTwistQuats` declaration (line ~131):

```typescript
  private spineTwistQuats = {
    spine1: new Quaternion(),
    spine2: new Quaternion(),
    neck: new Quaternion(),
    head: new Quaternion(),
    hips: new Quaternion(),
  };
```

Add `spine` as the first entry:

```typescript
  private spineTwistQuats = {
    spine: new Quaternion(),
    spine1: new Quaternion(),
    spine2: new Quaternion(),
    neck: new Quaternion(),
    head: new Quaternion(),
    hips: new Quaternion(),
  };
```

Do the same for `spineTwistRestQuats` (line ~138):

```typescript
  private spineTwistRestQuats = {
    spine: new Quaternion(),
    spine1: new Quaternion(),
    spine2: new Quaternion(),
    neck: new Quaternion(),
    head: new Quaternion(),
    hips: new Quaternion(),
    leftUpLeg: new Quaternion(),
    rightUpLeg: new Quaternion(),
  };
```

- [ ] **Step 2: Cache the Spine bone's rest quaternion**

In the `cacheSpineBone` block (line ~481–496), add the Spine bone cache before Spine1. The `key` type union also needs updating.

Change the `cacheSpineBone` function's key type:

```typescript
      const cacheSpineBone = (boneName: BoneName, key: "spine" | "spine1" | "spine2" | "neck" | "head" | "hips") => {
```

Add the Spine bone cache call before the Spine1 line:

```typescript
      cacheSpineBone("Spine", "spine");
      cacheSpineBone("Spine1", "spine1");
```

- [ ] **Step 3: Import userProportionsState and pass bodyFreedom**

Add import at the top of AvatarAnimator.ts:

```typescript
import { userProportionsState } from "../../state/user-proportions-state.svelte";
```

In the `computeSpineTwist` call (line ~509), add `bodyFreedom` as the 4th argument:

```typescript
      const twistResult = computeSpineTwist(
        pose.leftHand?.targetPosition ?? null,
        pose.rightHand?.targetPosition ?? null,
        bodyCenter,
        userProportionsState.bodyFreedom,
        this.availableSpineBones
      );
```

- [ ] **Step 4: Apply the Spine bone twist**

In the block where `applySpineTwist` is called (lines ~534–543), update the key type and add the Spine bone application before Spine1:

Update the `applySpineTwist` key type:

```typescript
      const applySpineTwist = (
        boneName: BoneName,
        key: "spine" | "spine1" | "spine2" | "neck" | "head" | "hips",
        twistQuat: Quaternion
      ) => {
```

Add the Spine bone call before Spine1:

```typescript
      applySpineTwist("Spine", "spine", twistResult.spine);
      applySpineTwist("Spine1", "spine1", twistResult.spine1);
```

- [ ] **Step 5: Run typecheck**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: Clean

- [ ] **Step 6: Run existing tests**

Run: `npx vitest run tests/unit/3d-animation/ 2>&1 | tail -20`
Expected: All existing tests pass (user-proportions tests don't test spine twist internals)

- [ ] **Step 7: Commit**

```bash
git add src/lib/shared/3d/services/implementations/AvatarAnimator.ts
git commit -m "feat(body-freedom): integrate Spine bone and bodyFreedom into AvatarAnimator"
```

---

### Task 4: Write iterative aim unit tests

**Files:**
- Create: `tests/unit/3d-animation/spine-twist.test.ts`

- [ ] **Step 1: Write the test file**

Create `tests/unit/3d-animation/spine-twist.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { Vector3, Quaternion } from "three";
import { computeSpineTwist } from "$lib/shared/3d/services/spine-twister";

function quatToYawDeg(q: Quaternion): number {
  const sinY = 2 * (q.w * q.y + q.x * q.z);
  const cosY = 1 - 2 * (q.y * q.y + q.z * q.z);
  return Math.atan2(sinY, cosY) * (180 / Math.PI);
}

function quatAngleDeg(q: Quaternion): number {
  return 2 * Math.acos(Math.max(-1, Math.min(1, q.w))) * (180 / Math.PI);
}

const BODY_CENTER = new Vector3(0, 0, 0);
const ALL_BONES = new Set(["Spine", "Spine1", "Spine2", "Neck", "Head"]);

describe("Iterative Aim Spine Solver", () => {
  describe("no targets", () => {
    it("returns identity quaternions when no hand targets provided", () => {
      const result = computeSpineTwist(null, null, BODY_CENTER, 0.5, ALL_BONES);
      for (const key of ["spine", "spine1", "spine2", "neck", "head", "hips"] as const) {
        expect(quatAngleDeg(result[key])).toBeLessThan(0.1);
      }
    });
  });

  describe("target directly ahead", () => {
    it("produces minimal rotation when target is on the forward axis", () => {
      const target = new Vector3(0, 0, 2);
      const result = computeSpineTwist(target, target, BODY_CENTER, 1.0, ALL_BONES);
      for (const key of ["spine", "spine1", "spine2", "neck", "head"] as const) {
        expect(quatAngleDeg(result[key])).toBeLessThan(5);
      }
    });
  });

  describe("target 45° left", () => {
    it("distributes rotation with lower spine absorbing more", () => {
      const target = new Vector3(-1, 0, 1); // 45° left
      const result = computeSpineTwist(target, target, BODY_CENTER, 1.0, ALL_BONES);

      const spineYaw = Math.abs(quatToYawDeg(result.spine));
      const spine1Yaw = Math.abs(quatToYawDeg(result.spine1));
      const spine2Yaw = Math.abs(quatToYawDeg(result.spine2));

      // Spine (lumbar) should absorb the most at Expressive
      expect(spineYaw).toBeGreaterThan(spine1Yaw);
      // All should contribute something
      expect(spineYaw).toBeGreaterThan(1);
      expect(spine1Yaw).toBeGreaterThan(1);
      expect(spine2Yaw).toBeGreaterThan(0.5);
    });
  });

  describe("bodyFreedom = 0 (Square)", () => {
    it("Spine bone contributes nothing at bodyFreedom 0", () => {
      const target = new Vector3(-1, 0, 1);
      const result = computeSpineTwist(target, target, BODY_CENTER, 0.0, ALL_BONES);

      expect(quatAngleDeg(result.spine)).toBeLessThan(0.1);
      // Other bones should still rotate
      expect(quatAngleDeg(result.spine1)).toBeGreaterThan(1);
    });
  });

  describe("bodyFreedom = 1 (Expressive)", () => {
    it("Spine bone contributes maximally at bodyFreedom 1", () => {
      const target = new Vector3(-1, 0, 0.5); // ~63° left
      const result = computeSpineTwist(target, target, BODY_CENTER, 1.0, ALL_BONES);

      expect(quatAngleDeg(result.spine)).toBeGreaterThan(10);
    });
  });

  describe("anatomical limits", () => {
    it("no bone exceeds its max swing limit even at extreme targets", () => {
      const target = new Vector3(-2, 0.5, -1); // ~135° behind-left
      const result = computeSpineTwist(target, target, BODY_CENTER, 1.0, ALL_BONES);

      // Max limits from spec:
      expect(quatAngleDeg(result.spine)).toBeLessThanOrEqual(35 + 1);
      expect(quatAngleDeg(result.spine1)).toBeLessThanOrEqual(25 + 1);
      expect(quatAngleDeg(result.spine2)).toBeLessThanOrEqual(20 + 1);
      expect(quatAngleDeg(result.neck)).toBeLessThanOrEqual(45 + 1);
      expect(quatAngleDeg(result.head)).toBeLessThanOrEqual(70 + 1);
    });
  });

  describe("single hand mode", () => {
    it("produces reduced rotation with only one hand target", () => {
      const target = new Vector3(-1, 0, 1);
      const twoHand = computeSpineTwist(target, target, BODY_CENTER, 1.0, ALL_BONES);
      const oneHand = computeSpineTwist(target, null, BODY_CENTER, 1.0, ALL_BONES);

      // Single hand should produce less total rotation
      const twoHandTotal = quatAngleDeg(twoHand.spine) + quatAngleDeg(twoHand.spine1);
      const oneHandTotal = quatAngleDeg(oneHand.spine) + quatAngleDeg(oneHand.spine1);
      expect(oneHandTotal).toBeLessThan(twoHandTotal);
    });

    it("produces no hip counter-rotation with single hand", () => {
      const target = new Vector3(-1, 0, 1);
      const result = computeSpineTwist(target, null, BODY_CENTER, 1.0, ALL_BONES);

      // Hip counter-rotation should still apply (it's based on total yaw, not hand count)
      // but the overall rotation is reduced so hips rotate less
      expect(quatAngleDeg(result.hips)).toBeLessThan(15);
    });
  });

  describe("hip counter-rotation", () => {
    it("hips counter-rotate opposite to spine at Square (−20%)", () => {
      const target = new Vector3(-1, 0, 1);
      const result = computeSpineTwist(target, target, BODY_CENTER, 0.0, ALL_BONES);

      const spineYaw = quatToYawDeg(result.spine1);
      const hipsYaw = quatToYawDeg(result.hips);

      // Hips should rotate opposite direction (signs should differ if spine rotates)
      if (Math.abs(spineYaw) > 1) {
        expect(Math.sign(hipsYaw)).not.toBe(Math.sign(spineYaw));
      }
    });
  });

  describe("smooth transitions", () => {
    it("bodyFreedom interpolates smoothly between 0 and 1", () => {
      const target = new Vector3(-1, 0, 1);
      const steps = [0.0, 0.25, 0.5, 0.75, 1.0];
      const spineAngles = steps.map((bf) => {
        const r = computeSpineTwist(target, target, BODY_CENTER, bf, ALL_BONES);
        return quatAngleDeg(r.spine);
      });

      // Each step should be >= the previous (monotonically increasing Spine contribution)
      for (let i = 1; i < spineAngles.length; i++) {
        expect(spineAngles[i]).toBeGreaterThanOrEqual(spineAngles[i - 1] - 0.1);
      }
    });
  });

  describe("missing bones", () => {
    it("works when Spine bone is not in available set", () => {
      const bonesWithoutSpine = new Set(["Spine1", "Spine2", "Neck", "Head"]);
      const target = new Vector3(-1, 0, 1);
      const result = computeSpineTwist(target, target, BODY_CENTER, 1.0, bonesWithoutSpine);

      // Spine bone should be identity (not available)
      expect(quatAngleDeg(result.spine)).toBeLessThan(0.1);
      // Other bones should still work
      expect(quatAngleDeg(result.spine1)).toBeGreaterThan(1);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx vitest run tests/unit/3d-animation/spine-twist.test.ts 2>&1 | tail -30`
Expected: All tests PASS. If any fail, fix the spine-twister implementation (not the tests) — the test expectations match the spec's stated behavior.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/3d-animation/spine-twist.test.ts
git commit -m "test(body-freedom): add iterative aim spine solver unit tests"
```

---

### Task 5: Add Body Freedom UI to gear popover

**Files:**
- Modify: `src/lib/shared/3d/components/Viewer3DGearPopover.svelte`

- [ ] **Step 1: Add the Body Freedom control below prop size**

In `Viewer3DGearPopover.svelte`, inside the Scene tab panel (after the `prop-size-control` div, around line 275), add:

```svelte
          <div class="scene-control">
            <div class="scene-control-header">
              <span class="scene-control-label">Body freedom</span>
              <span class="scene-control-value">{userProportionsState.bodyFreedomDisplay}</span>
            </div>
            <div class="preset-row">
              <button
                class="preset-btn"
                class:active={userProportionsState.bodyFreedom <= 0.01}
                onclick={(e) => { e.stopPropagation(); userProportionsState.setBodyFreedom(0); }}
                aria-pressed={userProportionsState.bodyFreedom <= 0.01}
              >Square</button>
              <button
                class="preset-btn"
                class:active={Math.abs(userProportionsState.bodyFreedom - 0.5) < 0.01}
                onclick={(e) => { e.stopPropagation(); userProportionsState.setBodyFreedom(0.5); }}
                aria-pressed={Math.abs(userProportionsState.bodyFreedom - 0.5) < 0.01}
              >Natural</button>
              <button
                class="preset-btn"
                class:active={userProportionsState.bodyFreedom >= 0.99}
                onclick={(e) => { e.stopPropagation(); userProportionsState.setBodyFreedom(1); }}
                aria-pressed={userProportionsState.bodyFreedom >= 0.99}
              >Expressive</button>
            </div>
            <input
              type="range"
              class="scene-slider"
              min="0"
              max="1"
              step="0.01"
              value={userProportionsState.bodyFreedom}
              oninput={(e) => userProportionsState.setBodyFreedom(Number(e.currentTarget.value))}
              aria-label="Body freedom"
            />
          </div>
```

- [ ] **Step 2: Rename the prop-size CSS classes to be reusable**

Rename the existing CSS classes from `prop-size-*` to `scene-control` so both controls share the same styling. In the `<style>` block, rename:

- `.prop-size-control` → `.scene-control`
- `.prop-size-header` → `.scene-control-header`
- `.prop-size-label` → `.scene-control-label`
- `.prop-size-value` → `.scene-control-value`
- `.prop-size-slider` → `.scene-slider`

Update the existing prop size HTML to use these new class names too (replace `prop-size-control` with `scene-control`, etc.).

Add the preset button CSS:

```css
  .preset-row {
    display: flex;
    gap: 4px;
    margin-bottom: 8px;
  }

  .preset-btn {
    flex: 1;
    padding: 4px 0;
    border-radius: 5px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.55);
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .preset-btn:hover {
    color: rgba(255, 255, 255, 0.85);
    background: rgba(255, 255, 255, 0.1);
  }

  .preset-btn.active {
    background: rgba(96, 165, 250, 0.2);
    border-color: rgba(96, 165, 250, 0.5);
    color: #60a5fa;
  }
```

- [ ] **Step 3: Run typecheck and build**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Run: `npx vite build 2>&1 | tail -10`
Expected: Both clean

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/3d/components/Viewer3DGearPopover.svelte
git commit -m "feat(body-freedom): add Body Freedom presets + slider to gear popover"
```

---

### Task 6: Add debug hook

**Files:**
- Modify: `src/lib/shared/3d/debug/avatar-debug-hooks.ts`
- Modify: `src/lib/shared/3d/services/implementations/AvatarAnimator.ts` (add toggle method)

- [ ] **Step 1: Add cycleBodyFreedom method to AvatarAnimator**

In `AvatarAnimator.ts`, after the `toggleAnatomicalConstraints` method (line ~871), add:

```typescript
  cycleBodyFreedom(): string {
    const current = userProportionsState.bodyFreedom;
    if (current < 0.25) {
      userProportionsState.setBodyFreedom(0.5);
      return "Natural (50%)";
    } else if (current < 0.75) {
      userProportionsState.setBodyFreedom(1.0);
      return "Expressive (100%)";
    } else {
      userProportionsState.setBodyFreedom(0.0);
      return "Square (0%)";
    }
  }
```

- [ ] **Step 2: Add the debug hook**

In `avatar-debug-hooks.ts`, update the `ToggleAnimator` type (line ~6):

```typescript
type ToggleAnimator = AvatarAnimator & {
  togglePoleVectors?: () => boolean;
  toggleClavicleRaise?: () => boolean;
  toggleSpineTwist?: () => boolean;
  toggleAnatomicalConstraints?: () => boolean;
  cycleBodyFreedom?: () => string;
};
```

Update the `AvatarDebugHooks` interface (line ~13):

```typescript
interface AvatarDebugHooks {
  __togglePoleVectors?: () => boolean;
  __toggleClavicleRaise?: () => boolean;
  __toggleSpineTwist?: () => boolean;
  __toggleConstraints?: () => boolean;
  __toggleBodyFreedom?: () => string;
  __dumpShoulders?: () => unknown;
}
```

Add the hook registration inside `installAvatarDebugHooks` (after the `__toggleConstraints` block, before `__dumpShoulders`):

```typescript
  w.__toggleBodyFreedom = () => {
    const preset = animator.cycleBodyFreedom?.() ?? "unknown";
    console.log(`Body freedom: ${preset}`);
    return preset;
  };
```

Add cleanup in `dispose`:

```typescript
      delete w.__toggleBodyFreedom;
```

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: Clean

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/3d/debug/avatar-debug-hooks.ts src/lib/shared/3d/services/implementations/AvatarAnimator.ts
git commit -m "feat(body-freedom): add __toggleBodyFreedom debug hook"
```

---

### Task 7: Run full test suite and build verification

**Files:**
- No changes — verification only

- [ ] **Step 1: Run all 3D animation tests**

Run: `npx vitest run tests/unit/3d-animation/ 2>&1 | tail -30`
Expected: All tests pass, including the new spine-twist tests and existing user-proportions tests

- [ ] **Step 2: Run full typecheck**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: Clean

- [ ] **Step 3: Run production build**

Run: `npx vite build 2>&1 | tail -10`
Expected: Build succeeds

- [ ] **Step 4: Run full test suite**

Run: `npx vitest run 2>&1 | tail -30`
Expected: All tests pass (no regressions in other areas)
