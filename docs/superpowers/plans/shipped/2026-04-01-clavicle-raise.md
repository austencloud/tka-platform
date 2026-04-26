# Clavicle Raise Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically elevate the avatar's clavicle bones when hands go above shoulder height, following real scapulohumeral rhythm biomechanics.

**Architecture:** A new stateless `ClavicleRaiser` service computes a rotation quaternion based on hand elevation relative to shoulder rest height. Applied in `AvatarAnimator.applyIKToSkeleton()` before the IK solve so the arm chain starts from the elevated shoulder. Smoothed via slerp using the existing `smoothingFactor`.

**Tech Stack:** Three.js (Vector3, Quaternion math), TypeScript, Vitest

**Spec:** `docs/superpowers/specs/2026-04-01-clavicle-raise-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/lib/shared/3d/services/contracts/IClavicleRaiser.ts` | Create | Interface — single `computeClavicleRotation` method |
| `src/lib/shared/3d/services/implementations/ClavicleRaiser.ts` | Create | Pure math — elevation-aware clavicle rotation |
| `src/lib/shared/3d/services/implementations/AvatarAnimator.ts` | Modify | Accept optional `ClavicleRaiser`, apply before IK solve |
| `src/lib/shared/3d/components/Avatar3D.svelte` | Modify | Instantiate `ClavicleRaiser`, pass to `AvatarAnimator` |
| `tests/unit/3d-animation/ClavicleRaiser.test.ts` | Create | Unit tests for clavicle rotation math |

---

## Task 1: Create `ClavicleRaiser` — test first

**Files:**
- Create: `src/lib/shared/3d/services/contracts/IClavicleRaiser.ts`
- Create: `src/lib/shared/3d/services/implementations/ClavicleRaiser.ts`
- Create: `tests/unit/3d-animation/ClavicleRaiser.test.ts`

- [ ] **Step 1: Create the interface**

```typescript
// src/lib/shared/3d/services/contracts/IClavicleRaiser.ts

/**
 * IClavicleRaiser
 *
 * Computes how much to elevate the clavicle (shoulder) bone based on
 * how high the hand is reaching. When you raise your arm above your
 * shoulder, your collarbone tilts upward to give your arm more reach.
 * Without this, the avatar looks stiff during overhead positions.
 *
 * Based on scapulohumeral rhythm: the clavicle contributes ~15° of
 * elevation during full arm abduction, activating after the arm passes
 * about 30° above horizontal (the "setting phase" where the shoulder
 * barely moves).
 *
 * Pure function. No state. Each call is independent.
 */

import type { Vector3, Quaternion } from "three";

export interface IClavicleRaiser {
  /**
   * Compute the rotation to apply to the clavicle bone.
   *
   * @param handTarget - Where the hand needs to be (world space)
   * @param side - Which shoulder ("left" or "right")
   * @param shoulderRestY - Y position of shoulder joint at rest (world space)
   * @param armLength - Total arm length (upper + lower) for scale-independent normalization
   * @returns Quaternion rotation to apply to the clavicle bone
   */
  computeClavicleRotation(
    handTarget: Vector3,
    side: "left" | "right",
    shoulderRestY: number,
    armLength: number
  ): Quaternion;
}
```

- [ ] **Step 2: Write failing tests**

```typescript
// tests/unit/3d-animation/ClavicleRaiser.test.ts

import { describe, it, expect } from "vitest";
import { Vector3, Quaternion } from "three";
import { ClavicleRaiser } from "$lib/shared/3d/services/implementations/ClavicleRaiser";

/**
 * Extract the rotation angle in degrees from a quaternion.
 * For small single-axis rotations, this gives us the magnitude.
 */
function angleDegrees(q: Quaternion): number {
  const angle = 2 * Math.acos(Math.min(1, Math.abs(q.w)));
  return (angle * 180) / Math.PI;
}

function expectUnitQuaternion(q: Quaternion) {
  expect(q.length()).toBeCloseTo(1, 4);
}

function expectIdentity(q: Quaternion) {
  expect(q.w).toBeCloseTo(1, 3);
  expect(q.x).toBeCloseTo(0, 3);
  expect(q.y).toBeCloseTo(0, 3);
  expect(q.z).toBeCloseTo(0, 3);
}

describe("ClavicleRaiser", () => {
  const raiser = new ClavicleRaiser();
  const shoulderRestY = 1.4; // shoulder at 1.4m (typical humanoid)
  const armLength = 0.55; // ~55cm total arm length

  describe("hand below shoulder: no rotation", () => {
    it("hand at waist height", () => {
      const q = raiser.computeClavicleRotation(
        new Vector3(0.3, 0.9, 0), "left", shoulderRestY, armLength
      );
      expectIdentity(q);
    });

    it("hand at shoulder height", () => {
      const q = raiser.computeClavicleRotation(
        new Vector3(0.3, shoulderRestY, 0), "left", shoulderRestY, armLength
      );
      expectIdentity(q);
    });
  });

  describe("activation threshold: setting phase", () => {
    it("hand slightly above shoulder: still no rotation (within setting phase)", () => {
      // 10% of arm length above shoulder — below 20% threshold
      const q = raiser.computeClavicleRotation(
        new Vector3(0, shoulderRestY + armLength * 0.1, 0),
        "left", shoulderRestY, armLength
      );
      expectIdentity(q);
    });

    it("hand just past threshold: small but nonzero rotation", () => {
      // 25% of arm length above shoulder — past 20% threshold
      const q = raiser.computeClavicleRotation(
        new Vector3(0, shoulderRestY + armLength * 0.25, 0),
        "left", shoulderRestY, armLength
      );
      expectUnitQuaternion(q);
      const angle = angleDegrees(q);
      expect(angle).toBeGreaterThan(0);
      expect(angle).toBeLessThan(5); // small — just past threshold
    });
  });

  describe("overhead positions", () => {
    it("hand well above shoulder: significant rotation", () => {
      // 60% of arm length above shoulder
      const q = raiser.computeClavicleRotation(
        new Vector3(0, shoulderRestY + armLength * 0.6, 0),
        "left", shoulderRestY, armLength
      );
      expectUnitQuaternion(q);
      const angle = angleDegrees(q);
      expect(angle).toBeGreaterThan(3);
      expect(angle).toBeLessThan(15);
    });

    it("hand at maximum reach: capped at 15 degrees", () => {
      // Full arm length above shoulder
      const q = raiser.computeClavicleRotation(
        new Vector3(0, shoulderRestY + armLength, 0),
        "left", shoulderRestY, armLength
      );
      expectUnitQuaternion(q);
      const angle = angleDegrees(q);
      expect(angle).toBeCloseTo(15, 0); // MAX_CLAVICLE_ELEVATION
    });

    it("hand beyond maximum reach: still capped at 15 degrees", () => {
      // 150% of arm length above shoulder (unreachable but clamped)
      const q = raiser.computeClavicleRotation(
        new Vector3(0, shoulderRestY + armLength * 1.5, 0),
        "left", shoulderRestY, armLength
      );
      expectUnitQuaternion(q);
      const angle = angleDegrees(q);
      expect(angle).toBeCloseTo(15, 0);
    });
  });

  describe("left vs right: opposite rotation directions", () => {
    it("same elevation produces opposite Z rotations", () => {
      const leftQ = raiser.computeClavicleRotation(
        new Vector3(0, shoulderRestY + armLength * 0.6, 0),
        "left", shoulderRestY, armLength
      );
      const rightQ = raiser.computeClavicleRotation(
        new Vector3(0, shoulderRestY + armLength * 0.6, 0),
        "right", shoulderRestY, armLength
      );

      // Both should have same magnitude
      expect(angleDegrees(leftQ)).toBeCloseTo(angleDegrees(rightQ), 1);

      // But opposite Z component (the rotation axis sign flips)
      expect(Math.sign(leftQ.z)).not.toBe(Math.sign(rightQ.z));
    });
  });

  describe("all results are unit quaternions", () => {
    const positions = [
      new Vector3(0, 0.5, 0),                          // below
      new Vector3(0, shoulderRestY, 0),                 // at shoulder
      new Vector3(0, shoulderRestY + armLength * 0.5, 0), // mid
      new Vector3(0, shoulderRestY + armLength, 0),     // max
      new Vector3(0, shoulderRestY + armLength * 2, 0), // beyond
    ];
    positions.forEach((pos, i) => {
      it(`position ${i}: unit quaternion`, () => {
        const q = raiser.computeClavicleRotation(pos, "left", shoulderRestY, armLength);
        expectUnitQuaternion(q);
      });
    });
  });

  describe("monotonic increase", () => {
    it("higher hand produces equal or greater rotation", () => {
      const heights = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
      let prevAngle = 0;
      for (const h of heights) {
        const q = raiser.computeClavicleRotation(
          new Vector3(0, shoulderRestY + armLength * h, 0),
          "left", shoulderRestY, armLength
        );
        const angle = angleDegrees(q);
        expect(angle).toBeGreaterThanOrEqual(prevAngle - 0.001); // tiny float tolerance
        prevAngle = angle;
      }
    });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/unit/3d-animation/ClavicleRaiser.test.ts`
Expected: FAIL — `ClavicleRaiser` does not exist yet.

- [ ] **Step 4: Implement `ClavicleRaiser`**

```typescript
// src/lib/shared/3d/services/implementations/ClavicleRaiser.ts

/**
 * ClavicleRaiser
 *
 * When you raise your arm overhead, your collarbone (clavicle) tilts
 * upward at the sternoclavicular joint to give the arm more room. This
 * is called scapulohumeral rhythm. Without it, animated characters look
 * stiff when reaching above their shoulders.
 *
 * The real biomechanics (Inman 1944, Ludewig 2009):
 * - 0°–30° arm elevation: "setting phase" — clavicle barely moves
 * - 30°–90°: clavicle starts elevating
 * - 90°–180°: clavicle reaches max ~15° elevation
 *
 * This implementation follows the FinalIK ShoulderRotator pattern used
 * in thousands of game titles: rotate the clavicle bone before the IK
 * solver reads the skeleton, so the arm chain naturally starts from
 * the elevated shoulder position.
 */

import { Vector3, Quaternion } from "three";
import type { IClavicleRaiser } from "../contracts/IClavicleRaiser";

/** Maximum clavicle elevation in radians (~15 degrees) */
const MAX_CLAVICLE_ELEVATION = (15 * Math.PI) / 180;

/**
 * What fraction of arm length the hand must exceed above shoulder
 * before the clavicle starts responding. Maps to the anatomical
 * "setting phase" where the scapula barely moves.
 */
const ACTIVATION_THRESHOLD = 0.2;

export class ClavicleRaiser implements IClavicleRaiser {
  computeClavicleRotation(
    handTarget: Vector3,
    side: "left" | "right",
    shoulderRestY: number,
    armLength: number
  ): Quaternion {
    const identity = new Quaternion();

    // How far above the shoulder is the hand?
    const elevationAbove = handTarget.y - shoulderRestY;
    if (elevationAbove <= 0 || armLength <= 0) {
      return identity;
    }

    // Normalize by arm length so the same logic works at any avatar scale
    const elevationRatio = Math.min(1, elevationAbove / armLength);

    // Setting phase: no rotation below the activation threshold
    if (elevationRatio < ACTIVATION_THRESHOLD) {
      return identity;
    }

    // Remap from [threshold, 1] to [0, 1]
    const normalizedRatio =
      (elevationRatio - ACTIVATION_THRESHOLD) / (1 - ACTIVATION_THRESHOLD);

    // Smoothstep for natural ease-in — avoids visible twitch near threshold
    const smoothed =
      normalizedRatio * normalizedRatio * (3 - 2 * normalizedRatio);

    // Final angle, capped at anatomical maximum
    const angle = smoothed * MAX_CLAVICLE_ELEVATION;

    // Rotate around local Z axis
    // Left shoulder: positive Z lifts the shoulder upward
    // Right shoulder: negative Z lifts the shoulder upward
    const sign = side === "left" ? 1 : -1;

    const result = new Quaternion();
    result.setFromAxisAngle(new Vector3(0, 0, 1), angle * sign);
    return result;
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/unit/3d-animation/ClavicleRaiser.test.ts`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/3d/services/contracts/IClavicleRaiser.ts src/lib/shared/3d/services/implementations/ClavicleRaiser.ts tests/unit/3d-animation/ClavicleRaiser.test.ts
git commit -m "feat(3d): add ClavicleRaiser with scapulohumeral rhythm

Computes clavicle bone elevation based on hand height above shoulder.
Follows real biomechanics: 15° max elevation, setting phase threshold,
smoothstep activation. FinalIK ShoulderRotator-inspired pattern.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Integrate into `AvatarAnimator`

**Files:**
- Modify: `src/lib/shared/3d/services/implementations/AvatarAnimator.ts`

- [ ] **Step 1: Add imports and fields**

Add import at the top:
```typescript
import type { IClavicleRaiser } from "../contracts/IClavicleRaiser";
```

Change the existing three.js import from:
```typescript
import { Vector3 } from "three";
```
to:
```typescript
import { Vector3, Quaternion } from "three";
```

Add fields after the existing pole vector fields:
```typescript
private clavicleRaiser: IClavicleRaiser | null;
private leftClavicleQuat = new Quaternion();
private rightClavicleQuat = new Quaternion();
private _clavicleRaiseEnabled = true;
// Cached shoulder rest Y positions — captured once when skeleton loads.
// Must NOT be read per-frame after clavicle rotation, or the elevated
// position feeds back into the next frame and causes oscillation.
private leftShoulderRestY = 0;
private rightShoulderRestY = 0;
private shoulderRestCached = false;
```

- [ ] **Step 2: Update constructor**

Add `clavicleRaiser` as an optional parameter after `poleComputer`:

```typescript
constructor(
  private ikSolver: IIKSolver,
  private skeleton: IAvatarSkeletonBuilder,
  poleComputer?: IElbowPoleComputer,
  clavicleRaiser?: IClavicleRaiser
) {
  this.poleComputer = poleComputer ?? null;
  this.clavicleRaiser = clavicleRaiser ?? null;
  this.idlePose = createIdlePose();
  this.currentPose = { ...this.idlePose };
  this.targetPose = { ...this.idlePose };
}
```

- [ ] **Step 3: Add clavicle rotation before IK solve in `applyIKToSkeleton()`**

Insert shoulder rest Y caching and clavicle rotation **before** each `this.ikSolver.solveAndApply()` call.

First, at the top of `applyIKToSkeleton()`, after the `bodyCenter` computation, add the one-time cache:

```typescript
// Cache shoulder rest Y positions once (before any clavicle rotation has been applied).
// CRITICAL: Do NOT read these per-frame after clavicle is rotated — the elevated
// position feeds back and causes oscillation.
if (!this.shoulderRestCached && leftChain && rightChain) {
  const leftRoot = new Vector3();
  const rightRoot = new Vector3();
  leftChain.root.getWorldPosition(leftRoot);
  rightChain.root.getWorldPosition(rightRoot);
  this.leftShoulderRestY = leftRoot.y;
  this.rightShoulderRestY = rightRoot.y;
  this.shoulderRestCached = true;
}
```

Then the left arm section (starting at the `if (leftChain)` block around line 274) becomes:

```typescript
if (leftChain) {
  // Clavicle raise: elevate shoulder bone before IK solve
  if (this._clavicleRaiseEnabled && this.clavicleRaiser && this.shoulderRestCached) {
    const leftShoulder = state.bones.get("LeftShoulder");
    if (leftShoulder) {
      const targetQuat = this.clavicleRaiser.computeClavicleRotation(
        pose.leftHand.targetPosition,
        "left",
        this.leftShoulderRestY,
        leftChain.totalLength
      );
      this.leftClavicleQuat.slerp(targetQuat, this.smoothingFactor);
      leftShoulder.quaternion.copy(this.leftClavicleQuat);
      leftShoulder.updateMatrixWorld(true);
    }
  }

  const target: IKTarget = {
    position: pose.leftHand.targetPosition,
    weight: pose.leftHand.weight,
  };

  // ... existing pole vector code ...
```

Same pattern for the right arm:

```typescript
if (rightChain) {
  // Clavicle raise: elevate shoulder bone before IK solve
  if (this._clavicleRaiseEnabled && this.clavicleRaiser && this.shoulderRestCached) {
    const rightShoulder = state.bones.get("RightShoulder");
    if (rightShoulder) {
      const targetQuat = this.clavicleRaiser.computeClavicleRotation(
        pose.rightHand.targetPosition,
        "right",
        this.rightShoulderRestY,
        rightChain.totalLength
      );
      this.rightClavicleQuat.slerp(targetQuat, this.smoothingFactor);
      rightShoulder.quaternion.copy(this.rightClavicleQuat);
      rightShoulder.updateMatrixWorld(true);
    }
  }

  const target: IKTarget = {
    position: pose.rightHand.targetPosition,
    weight: pose.rightHand.weight,
  };

  // ... existing pole vector code ...
```

- [ ] **Step 4: Add debug toggle**

Add alongside the existing `togglePoleVectors()` method:

```typescript
/** Debug toggle: disable clavicle raise to compare old vs new shoulder behavior */
toggleClavicleRaise(): boolean {
  this._clavicleRaiseEnabled = !this._clavicleRaiseEnabled;
  if (!this._clavicleRaiseEnabled) {
    this.leftClavicleQuat.identity();
    this.rightClavicleQuat.identity();
  }
  return this._clavicleRaiseEnabled;
}
```

- [ ] **Step 5: Run typecheck**

Run: `npm run check`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/3d/services/implementations/AvatarAnimator.ts
git commit -m "feat(3d): integrate ClavicleRaiser into AvatarAnimator

Applies clavicle elevation before IK solve so the arm chain starts
from the raised shoulder position. Smoothed via slerp. Includes
debug toggle (toggleClavicleRaise).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Wire up in `Avatar3D.svelte`

**Files:**
- Modify: `src/lib/shared/3d/components/Avatar3D.svelte`

- [ ] **Step 1: Import and instantiate `ClavicleRaiser`**

Add import:
```typescript
import { ClavicleRaiser } from "../services/implementations/ClavicleRaiser";
```

Update the service creation block (around line 233-234):
```typescript
const poleComputer = new ElbowPoleComputer();
const clavicleRaiser = new ClavicleRaiser();
const animator = new AvatarAnimator(solver, skeleton, poleComputer, clavicleRaiser);
```

- [ ] **Step 2: Add debug toggle to window**

Add alongside the existing `__togglePoleVectors`:
```typescript
(window as any).__toggleClavicleRaise = () => {
  const enabled = animator.toggleClavicleRaise();
  console.log(`Clavicle raise: ${enabled ? "ON (shoulders elevate)" : "OFF (shoulders static)"}`);
  return enabled;
};
```

- [ ] **Step 3: Run typecheck and tests**

Run: `npm run check && npx vitest run tests/unit/3d-animation/ClavicleRaiser.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/3d/components/Avatar3D.svelte
git commit -m "feat(3d): wire ClavicleRaiser into Avatar3D

Avatar shoulders now elevate when hands go overhead. Debug toggle
available via window.__toggleClavicleRaise() in browser console.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Verify visually

- [ ] **Step 1: Visual verification**

Navigate to the 3D viewer with a sequence that has overhead positions (North grid positions). Verify:
1. Shoulders visibly lift when hands go to North positions
2. Shoulders return to rest when hands come back down
3. No visible twitch or jump near the activation threshold
4. A/B comparison: toggle `__toggleClavicleRaise()` in console to compare

If visual verification is not possible via automated tools: "I cannot verify this visually. Please load a sequence with overhead positions (North) and toggle `window.__toggleClavicleRaise()` in the console to compare. The shoulders should visibly lift when hands go above shoulder height."

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: All tests PASS (no regressions). ClavicleRaiser tests: all passing.
