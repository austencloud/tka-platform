# Distributed Spine Twist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rotate the avatar's spine and head toward cross-body hand positions, distributing the twist anatomically across Spine1/Spine2/Neck/Head.

**Architecture:** A new stateless `SpineTwister` service computes four quaternions (one per bone) from hand lateral offset and cross-body tension. Applied in `AvatarAnimator.applyIKToSkeleton()` after clavicle raise, before IK solve. Composed with rest quaternions (lesson from clavicle bug). Smoothed via slerp.

**Tech Stack:** Three.js (Vector3, Quaternion), TypeScript, Vitest

**Spec:** `docs/superpowers/specs/2026-04-01-spine-twist-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/lib/shared/3d/services/contracts/ISpineTwister.ts` | Create | Interface + `SpineTwistResult` type |
| `src/lib/shared/3d/services/implementations/SpineTwister.ts` | Create | Pure math — distributed twist computation |
| `src/lib/shared/3d/services/implementations/AvatarAnimator.ts` | Modify | Accept optional `SpineTwister`, apply after clavicle / before IK |
| `src/lib/shared/3d/components/Avatar3D.svelte` | Modify | Instantiate `SpineTwister`, pass to `AvatarAnimator` |
| `tests/unit/3d-animation/SpineTwister.test.ts` | Create | Unit tests |

---

## Task 1: Create `SpineTwister` — test first

**Files:**
- Create: `src/lib/shared/3d/services/contracts/ISpineTwister.ts`
- Create: `src/lib/shared/3d/services/implementations/SpineTwister.ts`
- Create: `tests/unit/3d-animation/SpineTwister.test.ts`

- [ ] **Step 1: Create the interface**

```typescript
// src/lib/shared/3d/services/contracts/ISpineTwister.ts

/**
 * ISpineTwister
 *
 * Computes how much the spine and head should rotate when the hands
 * are in cross-body positions. When you reach across your body, your
 * torso and head naturally turn toward the reaching direction. This
 * reframes the coordinate system so a cross-body reach becomes more
 * like a front-body reach from the spine's perspective.
 *
 * The twist is distributed anatomically: lower back barely moves,
 * upper back rotates moderately, head rotates the most.
 *
 * Pure function. No state. Each call is independent.
 */

import type { Vector3, Quaternion } from "three";

export interface SpineTwistResult {
  spine1: Quaternion;
  spine2: Quaternion;
  neck: Quaternion;
  head: Quaternion;
}

export interface ISpineTwister {
  /**
   * Compute distributed twist rotations for the spine chain.
   *
   * @param leftHandTarget - Left hand position (world space)
   * @param rightHandTarget - Right hand position (world space)
   * @param bodyCenter - Avatar's torso center (world space)
   * @returns Four quaternions to apply to Spine1, Spine2, Neck, Head
   */
  computeSpineTwist(
    leftHandTarget: Vector3,
    rightHandTarget: Vector3,
    bodyCenter: Vector3
  ): SpineTwistResult;
}
```

- [ ] **Step 2: Write failing tests**

```typescript
// tests/unit/3d-animation/SpineTwister.test.ts

import { describe, it, expect } from "vitest";
import { Vector3, Quaternion } from "three";
import { SpineTwister } from "$lib/shared/3d/services/implementations/SpineTwister";

function angleDegrees(q: Quaternion): number {
  const angle = 2 * Math.acos(Math.min(1, Math.abs(q.w)));
  return (angle * 180) / Math.PI;
}

function expectUnitQuaternion(q: Quaternion) {
  expect(q.length()).toBeCloseTo(1, 4);
}

function expectNearIdentity(q: Quaternion) {
  expect(angleDegrees(q)).toBeLessThan(0.5);
}

describe("SpineTwister", () => {
  const twister = new SpineTwister();
  const bodyCenter = new Vector3(0, 1, 0);

  describe("balanced hands: no twist", () => {
    it("hands equidistant on opposite sides", () => {
      const result = twister.computeSpineTwist(
        new Vector3(0.3, 1.2, 0),   // left hand at +X
        new Vector3(-0.3, 1.2, 0),  // right hand at -X
        bodyCenter
      );
      expectNearIdentity(result.spine1);
      expectNearIdentity(result.spine2);
      expectNearIdentity(result.neck);
      expectNearIdentity(result.head);
    });

    it("both hands at center", () => {
      const result = twister.computeSpineTwist(
        new Vector3(0, 1.2, 0),
        new Vector3(0, 1.2, 0),
        bodyCenter
      );
      expectNearIdentity(result.spine1);
      expectNearIdentity(result.spine2);
      expectNearIdentity(result.neck);
      expectNearIdentity(result.head);
    });
  });

  describe("both hands offset to one side", () => {
    it("both hands left: positive Y rotation (twist left)", () => {
      const result = twister.computeSpineTwist(
        new Vector3(0.4, 1.2, 0),   // left hand far left (+X = skeleton left)
        new Vector3(0.2, 1.2, 0),   // right hand also left
        bodyCenter
      );
      // All bones should have nonzero rotation
      expect(angleDegrees(result.spine1)).toBeGreaterThan(0.1);
      expect(angleDegrees(result.head)).toBeGreaterThan(0.1);
      // Y component positive = twist toward +X (left in skeleton space)
      expect(result.head.y).toBeGreaterThan(0);
    });

    it("both hands right: negative Y rotation (twist right)", () => {
      const result = twister.computeSpineTwist(
        new Vector3(-0.2, 1.2, 0),
        new Vector3(-0.4, 1.2, 0),
        bodyCenter
      );
      expect(angleDegrees(result.head)).toBeGreaterThan(0.1);
      // Y component negative = twist toward -X (right in skeleton space)
      expect(result.head.y).toBeLessThan(0);
    });
  });

  describe("cross-body tension", () => {
    it("hands crossing in opposite directions: nonzero twist from tension", () => {
      // Left hand crosses to right (-X), right hand crosses to left (+X)
      // The cross tension should produce some twist
      const result = twister.computeSpineTwist(
        new Vector3(-0.3, 1.2, 0),  // left hand crossed to right
        new Vector3(0.3, 1.2, 0),   // right hand crossed to left
        bodyCenter
      );
      // Cross tension creates twist even though lateral bias is zero
      // At minimum the head should show some rotation
      const totalAngle = angleDegrees(result.spine1) +
        angleDegrees(result.spine2) +
        angleDegrees(result.neck) +
        angleDegrees(result.head);
      expect(totalAngle).toBeGreaterThan(0.1);
    });
  });

  describe("distribution: head rotates most, spine1 least", () => {
    it("head angle > neck > spine2 > spine1", () => {
      const result = twister.computeSpineTwist(
        new Vector3(0.4, 1.2, 0),
        new Vector3(0.3, 1.2, 0),
        bodyCenter
      );
      const spine1Angle = angleDegrees(result.spine1);
      const spine2Angle = angleDegrees(result.spine2);
      const neckAngle = angleDegrees(result.neck);
      const headAngle = angleDegrees(result.head);

      expect(headAngle).toBeGreaterThan(neckAngle);
      expect(neckAngle).toBeGreaterThanOrEqual(spine2Angle);
      expect(spine2Angle).toBeGreaterThan(spine1Angle);
    });
  });

  describe("maximum twist capped", () => {
    it("extreme position doesn't exceed 25 degrees total", () => {
      const result = twister.computeSpineTwist(
        new Vector3(2, 1.2, 0),   // way far left
        new Vector3(2, 1.2, 0),   // both hands way far left
        bodyCenter
      );
      const totalAngle = angleDegrees(result.spine1) +
        angleDegrees(result.spine2) +
        angleDegrees(result.neck) +
        angleDegrees(result.head);
      expect(totalAngle).toBeLessThanOrEqual(26); // 25° + float tolerance
    });
  });

  describe("all results are unit quaternions", () => {
    it("balanced position", () => {
      const result = twister.computeSpineTwist(
        new Vector3(0.3, 1.2, 0),
        new Vector3(-0.3, 1.2, 0),
        bodyCenter
      );
      expectUnitQuaternion(result.spine1);
      expectUnitQuaternion(result.spine2);
      expectUnitQuaternion(result.neck);
      expectUnitQuaternion(result.head);
    });

    it("extreme offset", () => {
      const result = twister.computeSpineTwist(
        new Vector3(2, 1.2, 0),
        new Vector3(2, 1.2, 0),
        bodyCenter
      );
      expectUnitQuaternion(result.spine1);
      expectUnitQuaternion(result.spine2);
      expectUnitQuaternion(result.neck);
      expectUnitQuaternion(result.head);
    });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/unit/3d-animation/SpineTwister.test.ts`
Expected: FAIL — `SpineTwister` does not exist yet.

- [ ] **Step 4: Implement `SpineTwister`**

```typescript
// src/lib/shared/3d/services/implementations/SpineTwister.ts

/**
 * SpineTwister
 *
 * When your hands reach across your body, your torso and head naturally
 * turn toward the reaching direction. This reframes the coordinate
 * system — a cross-body reach becomes more like a front-body reach
 * from the spine's perspective. Without this, the avatar looks like
 * a mannequin bolted to a pole.
 *
 * The twist distributes anatomically up the spine chain:
 * - Spine1 (lower back): barely moves (15% of total)
 * - Spine2 (upper back): moderate rotation (25%)
 * - Neck: follows upper back (25%)
 * - Head: leads the rotation (35%)
 *
 * Biomechanics reference:
 * - Thoracic spine: ~47° total axial rotation capacity
 * - Cervical spine: ~85° total axial rotation capacity
 * - We use ~25° max total, well within safe range
 */

import { Vector3, Quaternion } from "three";
import type { ISpineTwister, SpineTwistResult } from "../contracts/ISpineTwister";

/** Maximum total twist in radians (~25 degrees), distributed across all bones */
const MAX_TOTAL_TWIST = (25 * Math.PI) / 180;

/** Half shoulder width for normalizing lateral offset (same as ElbowPoleComputer) */
const SHOULDER_HALF_WIDTH = 0.2;

/** How much cross-body tension contributes relative to lateral bias */
const CROSS_TENSION_WEIGHT = 0.3;

/**
 * Distribution weights — how much of the total twist each bone gets.
 * Increases up the chain: lower back barely moves, head leads.
 * Must sum to 1.0.
 */
const SPINE1_WEIGHT = 0.15;
const SPINE2_WEIGHT = 0.25;
const NECK_WEIGHT = 0.25;
const HEAD_WEIGHT = 0.35;

export class SpineTwister implements ISpineTwister {
  computeSpineTwist(
    leftHandTarget: Vector3,
    rightHandTarget: Vector3,
    bodyCenter: Vector3
  ): SpineTwistResult {
    const leftX = leftHandTarget.x - bodyCenter.x;
    const rightX = rightHandTarget.x - bodyCenter.x;

    // Lateral bias: average X offset of both hands.
    // Positive = both hands are on the skeleton's left (+X) side.
    const lateralBias = (leftX + rightX) / 2;

    // Cross-body tension: each hand's individual crossing distance.
    // Skeleton convention: left hand's natural side is +X, right hand's is -X.
    // Left hand crossing to right = negative leftX.
    // Right hand crossing to left = positive rightX.
    const leftCross = Math.max(0, -leftX);
    const rightCross = Math.max(0, rightX);
    const crossTension = (leftCross + rightCross) * CROSS_TENSION_WEIGHT;

    // Combined signal: lateral bias + cross tension contribution.
    // Cross tension always adds in the direction of the lateral bias,
    // or toward the side with more crossing if bias is near zero.
    const twistSignal = lateralBias + Math.sign(lateralBias || 1) * crossTension;

    // Normalize to [-1, 1] range by shoulder width
    const normalizedSignal = Math.max(-1, Math.min(1,
      twistSignal / SHOULDER_HALF_WIDTH
    ));

    // Total twist angle
    const totalAngle = normalizedSignal * MAX_TOTAL_TWIST;

    // Distribute across bones
    return {
      spine1: this.makeYRotation(totalAngle * SPINE1_WEIGHT),
      spine2: this.makeYRotation(totalAngle * SPINE2_WEIGHT),
      neck: this.makeYRotation(totalAngle * NECK_WEIGHT),
      head: this.makeYRotation(totalAngle * HEAD_WEIGHT),
    };
  }

  private makeYRotation(angle: number): Quaternion {
    const q = new Quaternion();
    if (Math.abs(angle) < 0.0001) return q; // identity for zero angle
    q.setFromAxisAngle(new Vector3(0, 1, 0), angle);
    return q;
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/unit/3d-animation/SpineTwister.test.ts`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/3d/services/contracts/ISpineTwister.ts src/lib/shared/3d/services/implementations/SpineTwister.ts tests/unit/3d-animation/SpineTwister.test.ts
git commit -m "feat(3d): add SpineTwister with distributed anatomical twist

Rotates Spine1/Spine2/Neck/Head when hands are in cross-body positions.
Distribution: 15%/25%/25%/35% — head leads, lower back barely moves.
Driven by lateral bias + cross-body tension. Max 25° total twist.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Integrate into `AvatarAnimator`

**Files:**
- Modify: `src/lib/shared/3d/services/implementations/AvatarAnimator.ts`

- [ ] **Step 1: Add imports and fields**

Add import:
```typescript
import type { ISpineTwister, SpineTwistResult } from "../contracts/ISpineTwister";
```

Add fields after the clavicle fields (around line 69):
```typescript
private spineTwister: ISpineTwister | null;
private spineTwistQuats = {
  spine1: new Quaternion(),
  spine2: new Quaternion(),
  neck: new Quaternion(),
  head: new Quaternion(),
};
private spineTwistRestQuats = {
  spine1: new Quaternion(),
  spine2: new Quaternion(),
  neck: new Quaternion(),
  head: new Quaternion(),
};
private _spineTwistEnabled = true;
private spineRestCached = false;
```

- [ ] **Step 2: Update constructor**

Add `spineTwister` as 5th optional parameter:

```typescript
constructor(
  private ikSolver: IIKSolver,
  private skeleton: IAvatarSkeletonBuilder,
  poleComputer?: IElbowPoleComputer,
  clavicleRaiser?: IClavicleRaiser,
  spineTwister?: ISpineTwister
) {
  this.poleComputer = poleComputer ?? null;
  this.clavicleRaiser = clavicleRaiser ?? null;
  this.spineTwister = spineTwister ?? null;
  this.idlePose = createIdlePose();
  this.currentPose = { ...this.idlePose };
  this.targetPose = { ...this.idlePose };
}
```

- [ ] **Step 3: Cache spine rest quaternions**

Inside `applyIKToSkeleton()`, after the `shoulderRestCached` block (around line 300), add:

```typescript
    // Cache spine bone rest quaternions once — COMPOSE with these, never replace
    if (!this.spineRestCached) {
      const boneNames = ["Spine1", "Spine2", "Neck", "Head"] as const;
      const keys = ["spine1", "spine2", "neck", "head"] as const;
      let allFound = true;
      for (let i = 0; i < boneNames.length; i++) {
        const bone = state.bones.get(boneNames[i]);
        if (bone) {
          this.spineTwistRestQuats[keys[i]].copy(bone.quaternion);
        } else {
          allFound = false;
        }
      }
      if (allFound) this.spineRestCached = true;
    }
```

- [ ] **Step 4: Apply spine twist after clavicle raises, before IK**

Insert this block after the `spineRestCached` caching and BEFORE the `if (leftChain)` block (around line 310). This applies once for the whole body, not per-arm:

```typescript
    // Spine twist: rotate torso and head toward cross-body hand positions
    if (this._spineTwistEnabled && this.spineTwister && this.spineRestCached) {
      const twistResult = this.spineTwister.computeSpineTwist(
        pose.leftHand.targetPosition,
        pose.rightHand.targetPosition,
        bodyCenter
      );

      const boneNames = ["Spine1", "Spine2", "Neck", "Head"] as const;
      const keys = ["spine1", "spine2", "neck", "head"] as const;
      for (let i = 0; i < boneNames.length; i++) {
        const bone = state.bones.get(boneNames[i]);
        if (bone) {
          const key = keys[i];
          this.spineTwistQuats[key].slerp(twistResult[key], this.smoothingFactor);
          bone.quaternion
            .copy(this.spineTwistRestQuats[key])
            .multiply(this.spineTwistQuats[key]);
          bone.updateMatrixWorld(true);
        }
      }
    }
```

- [ ] **Step 5: Add debug toggle**

Add alongside the existing toggles:

```typescript
  /** Debug toggle: disable spine twist to compare old vs new torso behavior */
  toggleSpineTwist(): boolean {
    this._spineTwistEnabled = !this._spineTwistEnabled;
    if (!this._spineTwistEnabled) {
      this.spineTwistQuats.spine1.identity();
      this.spineTwistQuats.spine2.identity();
      this.spineTwistQuats.neck.identity();
      this.spineTwistQuats.head.identity();
    }
    return this._spineTwistEnabled;
  }
```

- [ ] **Step 6: Run typecheck**

Run: `npm run check`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/shared/3d/services/implementations/AvatarAnimator.ts
git commit -m "feat(3d): integrate SpineTwister into AvatarAnimator

Applies distributed spine twist after clavicle raise, before IK solve.
Composes with rest quaternions to preserve original bone positions.
Includes debug toggle (toggleSpineTwist).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Wire up in `Avatar3D.svelte`

**Files:**
- Modify: `src/lib/shared/3d/components/Avatar3D.svelte`

- [ ] **Step 1: Import and instantiate**

Add import:
```typescript
import { SpineTwister } from "../services/implementations/SpineTwister";
```

Update the service creation block (around line 234-236):
```typescript
const poleComputer = new ElbowPoleComputer();
const clavicleRaiser = new ClavicleRaiser();
const spineTwister = new SpineTwister();
const animator = new AvatarAnimator(solver, skeleton, poleComputer, clavicleRaiser, spineTwister);
```

- [ ] **Step 2: Add debug toggle**

Add alongside the existing toggles:
```typescript
(window as any).__toggleSpineTwist = () => {
  const enabled = animator.toggleSpineTwist();
  console.log(`Spine twist: ${enabled ? "ON (torso/head rotate)" : "OFF (spine static)"}`);
  return enabled;
};
```

- [ ] **Step 3: Run typecheck and tests**

Run: `npm run check && npx vitest run tests/unit/3d-animation/SpineTwister.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/3d/components/Avatar3D.svelte
git commit -m "feat(3d): wire SpineTwister into Avatar3D

Avatar torso and head now rotate toward cross-body hand positions.
Debug toggle: window.__toggleSpineTwist() in browser console.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Verify

- [ ] **Step 1: Visual verification**

Navigate to the 3D viewer with a sequence that has cross-body positions. Toggle `__toggleSpineTwist()` in console to A/B compare. The torso and head should visibly rotate toward the side where the hands are reaching.

If verification not possible: "I cannot verify visually. Please load a sequence with cross-body positions and toggle `window.__toggleSpineTwist()`. The head should turn toward the reaching direction and the torso should rotate slightly."

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run tests/unit/3d-animation/`
Expected: All tests PASS. SpineTwister + ElbowPoleComputer + ClavicleRaiser + existing tests.

- [ ] **Step 3: Dump spine bone data for tuning**

Run `__dumpShoulders()` (which also covers spine bones if extended) to verify:
1. Shoulder span hasn't collapsed (still ~0.3m)
2. Spine bones have non-identity quaternions during cross-body positions
3. Head rotation is largest, Spine1 smallest

Note: The Y-axis rotation may need tuning for this specific GLTF model's bone orientation, same as the clavicle X-axis discovery. If the twist looks wrong (rotating around the wrong axis), use the diagnostic pattern: log the bone's world matrix axes and determine the correct local axis for axial rotation.
