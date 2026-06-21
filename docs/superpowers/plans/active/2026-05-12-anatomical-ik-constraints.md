# Anatomical IK Constraints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add anatomical constraint enforcement to the 3D avatar arm IK pipeline so it only produces physically possible poses, and nudge the dual wheel plane offset forward to prevent shoulder cramping.

**Architecture:** A new `swing-twist-constraint.ts` module provides swing-twist quaternion decomposition, elliptical shoulder cone clamping, and elbow hinge clamping. `AvatarAnimator` calls these constraints after `solveTwoBone()` and before the animation blend. The analytic solver stays untouched — constraints are a post-processing guardrail.

**Tech Stack:** Three.js (Vector3, Quaternion, Matrix4), vitest for unit tests.

---

### Task 1: Swing-Twist Decomposition — Tests

**Files:**
- Create: `src/lib/shared/3d/services/swing-twist-constraint.test.ts`

- [ ] **Step 1: Create test file with swing-twist decomposition tests**

```typescript
import { describe, expect, it } from "vitest";
import { Quaternion, Vector3 } from "three";
import {
  decomposeSwingTwist,
  constrainShoulderCone,
  constrainElbowHinge,
} from "../swing-twist-constraint";

const EPSILON = 1e-5;

function expectQuatClose(q: Quaternion, expected: Quaternion, precision = 4) {
  // Quaternions q and -q represent the same rotation
  const sign = Math.sign(q.w * expected.w + q.x * expected.x + q.y * expected.y + q.z * expected.z) || 1;
  expect(q.x * sign).toBeCloseTo(expected.x, precision);
  expect(q.y * sign).toBeCloseTo(expected.y, precision);
  expect(q.z * sign).toBeCloseTo(expected.z, precision);
  expect(q.w * sign).toBeCloseTo(expected.w, precision);
}

describe("decomposeSwingTwist", () => {
  it("identity quaternion decomposes to identity swing and twist", () => {
    const q = new Quaternion(); // identity
    const twistAxis = new Vector3(1, 0, 0); // X axis
    const { swing, twist } = decomposeSwingTwist(q, twistAxis);
    expectQuatClose(swing, new Quaternion());
    expectQuatClose(twist, new Quaternion());
  });

  it("pure twist around axis stays in twist component", () => {
    const angle = Math.PI / 4; // 45 degrees
    const twistAxis = new Vector3(1, 0, 0);
    const q = new Quaternion().setFromAxisAngle(twistAxis, angle);
    const { swing, twist } = decomposeSwingTwist(q, twistAxis);
    // Swing should be identity (no swing component)
    expectQuatClose(swing, new Quaternion());
    // Twist should equal original
    expectQuatClose(twist, q);
  });

  it("pure swing perpendicular to axis stays in swing component", () => {
    const angle = Math.PI / 6; // 30 degrees
    const swingAxis = new Vector3(0, 1, 0); // perpendicular to X
    const twistAxis = new Vector3(1, 0, 0);
    const q = new Quaternion().setFromAxisAngle(swingAxis, angle);
    const { swing, twist } = decomposeSwingTwist(q, twistAxis);
    // Twist should be identity (no twist component)
    expectQuatClose(twist, new Quaternion());
    // Swing should equal original
    expectQuatClose(swing, q);
  });

  it("recomposition: swing * twist ≈ original", () => {
    // Arbitrary rotation
    const q = new Quaternion().setFromAxisAngle(
      new Vector3(1, 1, 1).normalize(),
      Math.PI / 3
    );
    const twistAxis = new Vector3(1, 0, 0);
    const { swing, twist } = decomposeSwingTwist(q, twistAxis);
    const recomposed = swing.clone().multiply(twist);
    expectQuatClose(recomposed, q);
  });
});

describe("constrainShoulderCone", () => {
  it("passes through rotation within cone limits", () => {
    // 30 degree forward swing — well within 160° forward limit
    const q = new Quaternion().setFromAxisAngle(
      new Vector3(0, 0, 1), // swing forward
      (30 * Math.PI) / 180
    );
    const restDir = new Vector3(1, 0, 0); // arm points along X in rest
    const result = constrainShoulderCone(q, restDir, "left");
    expectQuatClose(result, q);
  });

  it("clamps rotation exceeding backward limit", () => {
    // 90 degree backward swing — exceeds 60° backward limit
    const q = new Quaternion().setFromAxisAngle(
      new Vector3(0, 0, -1), // swing backward
      (90 * Math.PI) / 180
    );
    const restDir = new Vector3(1, 0, 0);
    const result = constrainShoulderCone(q, restDir, "left");
    // Result should differ from input (clamped)
    const diff = result.angleTo(q);
    expect(diff).toBeGreaterThan(0.01);
  });

  it("clamps adduction past 45 degrees", () => {
    // 70 degree adduction (across chest) — exceeds 45° limit
    const q = new Quaternion().setFromAxisAngle(
      new Vector3(0, 1, 0), // swing medially
      (70 * Math.PI) / 180
    );
    const restDir = new Vector3(1, 0, 0);
    const result = constrainShoulderCone(q, restDir, "left");
    const diff = result.angleTo(q);
    expect(diff).toBeGreaterThan(0.01);
  });
});

describe("constrainElbowHinge", () => {
  it("passes through valid flexion angle", () => {
    // 90 degree flexion — within 0–145° range
    const q = new Quaternion().setFromAxisAngle(
      new Vector3(0, 0, 1), // bend axis
      (90 * Math.PI) / 180
    );
    const bendAxis = new Vector3(0, 0, 1);
    const restDir = new Vector3(1, 0, 0);
    const result = constrainElbowHinge(q, bendAxis, restDir);
    expectQuatClose(result, q);
  });

  it("clamps hyperextension (negative angle)", () => {
    // -20 degrees — hyperextension, should clamp to 0
    const q = new Quaternion().setFromAxisAngle(
      new Vector3(0, 0, 1),
      (-20 * Math.PI) / 180
    );
    const bendAxis = new Vector3(0, 0, 1);
    const restDir = new Vector3(1, 0, 0);
    const result = constrainElbowHinge(q, bendAxis, restDir);
    // Should be close to identity (0° flexion)
    expectQuatClose(result, new Quaternion(), 2);
  });

  it("clamps past max flexion", () => {
    // 170 degrees — past the 145° limit
    const q = new Quaternion().setFromAxisAngle(
      new Vector3(0, 0, 1),
      (170 * Math.PI) / 180
    );
    const bendAxis = new Vector3(0, 0, 1);
    const restDir = new Vector3(1, 0, 0);
    const result = constrainElbowHinge(q, bendAxis, restDir);
    const diff = result.angleTo(q);
    expect(diff).toBeGreaterThan(0.01);
  });

  it("removes off-axis twist", () => {
    // Rotation with twist around the bone axis — should be stripped
    const flexion = new Quaternion().setFromAxisAngle(
      new Vector3(0, 0, 1),
      (60 * Math.PI) / 180
    );
    const twistContam = new Quaternion().setFromAxisAngle(
      new Vector3(1, 0, 0), // bone axis = twist
      (30 * Math.PI) / 180
    );
    const combined = flexion.clone().multiply(twistContam);
    const bendAxis = new Vector3(0, 0, 1);
    const restDir = new Vector3(1, 0, 0);
    const result = constrainElbowHinge(combined, bendAxis, restDir);
    // Result should be close to pure flexion (twist removed)
    expectQuatClose(result, flexion, 2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/shared/3d/services/swing-twist-constraint.test.ts`
Expected: FAIL — module `../swing-twist-constraint` does not exist yet.

- [ ] **Step 3: Commit test file**

```bash
git add src/lib/shared/3d/services/swing-twist-constraint.test.ts
git commit -m "test: add swing-twist constraint unit tests (red)"
```

---

### Task 2: Swing-Twist Decomposition — Implementation

**Files:**
- Create: `src/lib/shared/3d/services/swing-twist-constraint.ts`

- [ ] **Step 1: Implement the constraint module**

```typescript
import { Quaternion, Vector3 } from "three";

// ── Anatomical Limits (glenohumeral ROM from biomechanics literature) ──

/** Shoulder swing cone limits in radians */
const SHOULDER_LIMITS = {
  forward: (160 * Math.PI) / 180,
  backward: (60 * Math.PI) / 180,
  abduction: (170 * Math.PI) / 180,
  adduction: (45 * Math.PI) / 180,
};

const SHOULDER_TWIST_MIN = (-90 * Math.PI) / 180;
const SHOULDER_TWIST_MAX = (90 * Math.PI) / 180;
const ELBOW_FLEXION_MIN = 0;
const ELBOW_FLEXION_MAX = (145 * Math.PI) / 180;

// ── Swing-Twist Decomposition ──

export interface SwingTwist {
  swing: Quaternion;
  twist: Quaternion;
}

/**
 * Decompose quaternion Q into swing and twist components relative to a twist axis.
 *
 * Q = swing * twist
 *
 * Twist is the rotation component around twistAxis.
 * Swing is everything perpendicular to it.
 *
 * Reference: Allen Chou "Swing-Twist Interpolation" / Marc B. Reynolds quaternion axis factorization.
 */
export function decomposeSwingTwist(q: Quaternion, twistAxis: Vector3): SwingTwist {
  const projection = twistAxis.clone().multiplyScalar(
    q.x * twistAxis.x + q.y * twistAxis.y + q.z * twistAxis.z
  );

  const twist = new Quaternion(projection.x, projection.y, projection.z, q.w);
  const len = twist.length();

  if (len < 1e-10) {
    // Singularity: 180° swing with no twist component.
    // Return identity twist so swing = q.
    return { swing: q.clone(), twist: new Quaternion() };
  }

  twist.multiplyScalar(1 / len); // normalize

  const swing = q.clone().multiply(twist.clone().conjugate());

  return { swing, twist };
}

// ── Shoulder Cone Constraint ──

/**
 * Clamp a shoulder quaternion to an elliptical swing cone + twist range.
 *
 * The cone is elliptical: wider for abduction than adduction, wider forward than backward.
 * This matches the real glenohumeral joint's asymmetric range of motion.
 *
 * @param shoulderQuat - The shoulder's local rotation quaternion (from IK solver)
 * @param restDir - The bone's rest direction in local space (from BoneChain.rootRestDir)
 * @param side - "left" or "right" (adduction direction flips)
 */
export function constrainShoulderCone(
  shoulderQuat: Quaternion,
  restDir: Vector3,
  side: "left" | "right",
): Quaternion {
  const twistAxis = restDir.clone().normalize();
  const { swing, twist } = decomposeSwingTwist(shoulderQuat, twistAxis);

  // ── Clamp twist (internal/external rotation) ──
  const clampedTwist = clampTwistAngle(twist, twistAxis, SHOULDER_TWIST_MIN, SHOULDER_TWIST_MAX);

  // ── Clamp swing to elliptical cone ──
  const clampedSwing = clampSwingElliptical(swing, twistAxis, side);

  return clampedSwing.multiply(clampedTwist);
}

function clampTwistAngle(
  twist: Quaternion,
  twistAxis: Vector3,
  minRad: number,
  maxRad: number,
): Quaternion {
  // Extract the twist angle from the quaternion.
  // For a twist quaternion around twistAxis: q = (axis * sin(a/2), cos(a/2))
  const dotSign = twist.x * twistAxis.x + twist.y * twistAxis.y + twist.z * twistAxis.z;
  let angle = 2 * Math.atan2(Math.abs(dotSign), Math.abs(twist.w));
  if (dotSign < 0) angle = -angle;
  // Handle quaternion double-cover
  if (twist.w < 0) angle = -angle;

  const clamped = Math.max(minRad, Math.min(maxRad, angle));
  if (Math.abs(clamped - angle) < 1e-6) return twist.clone();

  return new Quaternion().setFromAxisAngle(twistAxis, clamped);
}

function clampSwingElliptical(
  swing: Quaternion,
  twistAxis: Vector3,
  side: "left" | "right",
): Quaternion {
  // Extract swing angle and direction
  const swingAngle = 2 * Math.acos(Math.max(-1, Math.min(1, swing.w)));
  if (swingAngle < 1e-6) return swing.clone(); // negligible swing

  // Swing axis (perpendicular to twist axis)
  const swingAxis = new Vector3(swing.x, swing.y, swing.z);
  const axisLen = swingAxis.length();
  if (axisLen < 1e-10) return swing.clone();
  swingAxis.divideScalar(axisLen);

  // Determine which anatomical direction this swing is pointing.
  // We need to classify the swing direction into the 4 quadrants:
  // forward/backward (Z component) and abduction/adduction (Y component).
  //
  // For a humanoid arm rest pose pointing along +X (or -X for right arm),
  // swinging the arm:
  //   - Forward/up = rotation around Z axis (positive)
  //   - Backward = rotation around -Z
  //   - Abduction (out) = rotation around Y
  //   - Adduction (across) = rotation around -Y (left arm) or +Y (right arm)
  //
  // The elliptical cone limit varies by direction.

  // Project swing axis onto the two perpendicular anatomical directions
  // relative to the twist axis. We use a local frame:
  //   - twistAxis = bone direction (X-like)
  //   - up = approximate anatomical up
  //   - forward = cross(up, twist)
  const up = new Vector3(0, 1, 0);
  let forward = new Vector3().crossVectors(up, twistAxis);
  if (forward.lengthSq() < 0.01) {
    // Twist axis is nearly vertical — use Z as forward
    forward = new Vector3(0, 0, 1);
  }
  forward.normalize();
  const actualUp = new Vector3().crossVectors(twistAxis, forward).normalize();

  const forwardComponent = swingAxis.dot(forward);  // >0 = forward, <0 = backward
  const upComponent = swingAxis.dot(actualUp);       // >0 = abduction, <0 = adduction

  // Compute the elliptical limit at this angle
  const azimuth = Math.atan2(upComponent, forwardComponent);

  // Map azimuth quadrants to anatomical limits
  const cosAz = Math.cos(azimuth);
  const sinAz = Math.sin(azimuth);

  // Ellipse radii in each direction
  const forwardLimit = cosAz >= 0 ? SHOULDER_LIMITS.forward : SHOULDER_LIMITS.backward;

  // Adduction direction depends on arm side
  const adductionSide = side === "left" ? -1 : 1;
  const abductionLimit = (sinAz * adductionSide) >= 0
    ? SHOULDER_LIMITS.abduction
    : SHOULDER_LIMITS.adduction;

  // Elliptical radius at this azimuth: r(θ) = ab / sqrt((b*cosθ)² + (a*sinθ)²)
  const a = forwardLimit;
  const b = abductionLimit;
  const denomSq = (b * cosAz) * (b * cosAz) + (a * sinAz) * (a * sinAz);
  const maxSwing = (a * b) / Math.sqrt(Math.max(1e-10, denomSq));

  if (swingAngle <= maxSwing) return swing.clone(); // within cone

  // Clamp: same axis, reduced angle
  return new Quaternion().setFromAxisAngle(swingAxis, maxSwing);
}

// ── Elbow Hinge Constraint ──

/**
 * Constrain the elbow to a 1-DOF hinge: only flexion in the bend plane, no off-axis twist.
 *
 * @param elbowQuat - The elbow's local rotation quaternion (from IK solver)
 * @param bendAxis - The axis the elbow bends around (from pole vector cross product), in elbow-local space
 * @param restDir - The forearm's rest direction in elbow-local space (BoneChain.middleRestDir)
 */
export function constrainElbowHinge(
  elbowQuat: Quaternion,
  bendAxis: Vector3,
  restDir: Vector3,
): Quaternion {
  // Decompose into swing (flexion around bend axis) and twist (axial rotation of forearm)
  const normalizedBend = bendAxis.clone().normalize();

  // The elbow rotation in the IK context is the rotation of the forearm
  // relative to the upper arm. We want to extract only the component
  // around the bend axis (flexion) and discard everything else.

  // Project the rotation onto the bend axis
  const { swing: flexionPart } = decomposeSwingTwist(elbowQuat, restDir);

  // The "swing" relative to restDir IS the flexion (it swings the forearm away from rest).
  // Extract the flexion angle.
  let flexionAngle = 2 * Math.acos(Math.max(-1, Math.min(1, flexionPart.w)));

  // Determine sign: is the flexion in the correct direction (toward bendAxis)?
  const flexionAxis = new Vector3(flexionPart.x, flexionPart.y, flexionPart.z);
  const axisLen = flexionAxis.length();
  if (axisLen > 1e-10) {
    flexionAxis.divideScalar(axisLen);
    // If flexion axis opposes the bend axis, angle is negative (hyperextension)
    if (flexionAxis.dot(normalizedBend) < 0) {
      flexionAngle = -flexionAngle;
    }
  }

  // Clamp to valid range
  const clampedAngle = Math.max(ELBOW_FLEXION_MIN, Math.min(ELBOW_FLEXION_MAX, flexionAngle));

  // Reconstruct as pure hinge rotation around the bend axis
  return new Quaternion().setFromAxisAngle(normalizedBend, clampedAngle);
}
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/lib/shared/3d/services/swing-twist-constraint.test.ts`
Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/services/swing-twist-constraint.ts
git commit -m "feat: add swing-twist constraint module for anatomical IK limits"
```

---

### Task 3: Integrate Constraints into AvatarAnimator

**Files:**
- Modify: `src/lib/shared/3d/services/implementations/AvatarAnimator.ts`

The constraint pass goes between `ikSolver.solveAndApply()` and the animation blend. When the shoulder is clamped, the forearm must be re-derived to stay consistent.

- [ ] **Step 1: Add import and state field**

At the top of `AvatarAnimator.ts`, add the import:

```typescript
import { constrainShoulderCone, constrainElbowHinge } from "../swing-twist-constraint";
```

Add a private field alongside the other toggle flags (near line 97):

```typescript
private _anatomicalConstraintsEnabled = true;
```

- [ ] **Step 2: Add constraint pass for left arm**

In `applyIKToSkeleton()`, after `this.ikSolver.solveAndApply(leftChain, target);` (line 606) and BEFORE the `ikRootQuat` capture (line 609), insert the constraint pass:

```typescript
        // Anatomical constraints: clamp shoulder cone + elbow hinge
        if (this._anatomicalConstraintsEnabled) {
          leftChain.root.quaternion.copy(
            constrainShoulderCone(leftChain.root.quaternion, leftChain.rootRestDir, "left")
          );
          // After shoulder clamp, re-derive forearm direction
          leftChain.root.updateMatrixWorld(true);
          const bendAxis = new Vector3().crossVectors(
            leftChain.rootRestDir,
            leftChain.middleRestDir
          ).normalize();
          leftChain.middle.quaternion.copy(
            constrainElbowHinge(leftChain.middle.quaternion, bendAxis, leftChain.middleRestDir)
          );
          leftChain.root.updateMatrixWorld(true);
        }
```

- [ ] **Step 3: Add constraint pass for right arm**

Same pattern after `this.ikSolver.solveAndApply(rightChain, target);` (line 668), before `ikRootQuat` capture (line 671):

```typescript
        // Anatomical constraints: clamp shoulder cone + elbow hinge
        if (this._anatomicalConstraintsEnabled) {
          rightChain.root.quaternion.copy(
            constrainShoulderCone(rightChain.root.quaternion, rightChain.rootRestDir, "right")
          );
          rightChain.root.updateMatrixWorld(true);
          const bendAxis = new Vector3().crossVectors(
            rightChain.rootRestDir,
            rightChain.middleRestDir
          ).normalize();
          rightChain.middle.quaternion.copy(
            constrainElbowHinge(rightChain.middle.quaternion, bendAxis, rightChain.middleRestDir)
          );
          rightChain.root.updateMatrixWorld(true);
        }
```

- [ ] **Step 4: Add toggle method**

After the existing `toggleSpineTwist()` method (around line 774):

```typescript
  toggleAnatomicalConstraints(): boolean {
    this._anatomicalConstraintsEnabled = !this._anatomicalConstraintsEnabled;
    return this._anatomicalConstraintsEnabled;
  }
```

- [ ] **Step 5: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/3d/services/implementations/AvatarAnimator.ts
git commit -m "feat: integrate anatomical constraints into IK pipeline"
```

---

### Task 4: Dual Wheel Forward Offset

**Files:**
- Modify: `src/lib/shared/3d/domain/constants/plane-mode-configs.ts:17-22`

- [ ] **Step 1: Update grid offsets**

Change `GRID_OFFSETS` so dual wheel and conjoined wheel have a forward offset of `0.10`:

```typescript
export const GRID_OFFSETS: Record<PlaneMode, number> = {
  [PlaneMode.WALL]: 0.3,
  [PlaneMode.DUAL_WHEEL]: 0.10,
  [PlaneMode.CUSTOM]: 0.3,
  [PlaneMode.CONJOINED_WHEEL]: 0.10,
};
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/domain/constants/plane-mode-configs.ts
git commit -m "fix: add 10cm forward offset to dual wheel plane modes for shoulder clearance"
```

---

### Task 5: Debug Toggle Hook

**Files:**
- Modify: `src/lib/shared/3d/debug/avatar-debug-hooks.ts`

- [ ] **Step 1: Add toggle type and hook**

Update the `ToggleAnimator` type to include the new method:

```typescript
type ToggleAnimator = AvatarAnimator & {
  togglePoleVectors?: () => boolean;
  toggleClavicleRaise?: () => boolean;
  toggleSpineTwist?: () => boolean;
  toggleAnatomicalConstraints?: () => boolean;
};
```

Update the `AvatarDebugHooks` interface:

```typescript
interface AvatarDebugHooks {
  __togglePoleVectors?: () => boolean;
  __toggleClavicleRaise?: () => boolean;
  __toggleSpineTwist?: () => boolean;
  __toggleConstraints?: () => boolean;
  __dumpShoulders?: () => unknown;
}
```

Add the hook inside `installAvatarDebugHooks`, after the `__toggleSpineTwist` block (around line 52):

```typescript
  w.__toggleConstraints = () => {
    const enabled = animator.toggleAnatomicalConstraints?.() ?? false;
    console.log(
      `Anatomical constraints: ${enabled ? "ON (cone + hinge)" : "OFF (unconstrained)"}`,
    );
    return enabled;
  };
```

Update the `dispose` function to include the new hook:

```typescript
  return {
    dispose: () => {
      delete w.__togglePoleVectors;
      delete w.__toggleClavicleRaise;
      delete w.__toggleSpineTwist;
      delete w.__toggleConstraints;
      delete w.__dumpShoulders;
    },
  };
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/debug/avatar-debug-hooks.ts
git commit -m "feat: add __toggleConstraints debug hook for A/B comparison"
```

---

### Task 6: Build Verification + Integration Smoke Test

**Files:**
- None new — verification only.

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All existing tests pass, plus the new `swing-twist-constraint.test.ts` tests.

- [ ] **Step 2: Run full build**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: No type errors.
