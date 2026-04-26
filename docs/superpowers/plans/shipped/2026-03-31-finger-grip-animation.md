# Finger Grip Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make 3D avatar hands visibly grip the staff prop instead of floating with flat/open hands.

**Architecture:** FingerAnimator is a new body-part animator (peer to LegAnimator) that slerps finger bone quaternions toward target grip poses. Poses are authored as static quaternion arrays, one per GripType. Finger bones are mapped from the existing GLTF skeleton (Mixamo models already have them — they're just skipped today).

**Tech Stack:** Svelte 5, TypeScript, Three.js (Quaternion, Bone), Vitest

**Spec:** `docs/superpowers/specs/2026-03-31-finger-grip-animation-design.md`

---

### Task 1: GripPose Data Types

**Files:**
- Create: `src/lib/shared/3d/domain/models/GripPose.ts`
- Test: `tests/unit/3d-animation/GripPose.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// tests/unit/3d-animation/GripPose.test.ts
import { describe, it, expect } from "vitest";
import {
  GripType,
  FINGER_BONES,
  mirrorQuaternion,
  type FingerBoneName,
} from "$lib/shared/3d/domain/models/GripPose";

describe("GripPose", () => {
  describe("FINGER_BONES", () => {
    it("has exactly 15 entries", () => {
      expect(FINGER_BONES).toHaveLength(15);
    });

    it("covers all 5 fingers with 3 bones each", () => {
      const fingers = ["Thumb", "Index", "Middle", "Ring", "Pinky"];
      for (const finger of fingers) {
        const bones = FINGER_BONES.filter((b) => b.startsWith(finger));
        expect(bones).toHaveLength(3);
        expect(bones).toEqual([`${finger}1`, `${finger}2`, `${finger}3`]);
      }
    });
  });

  describe("GripType", () => {
    it("has exactly 6 values", () => {
      expect(Object.values(GripType)).toHaveLength(6);
    });

    it("includes all expected grip types", () => {
      expect(GripType.IDLE).toBe("idle");
      expect(GripType.SQUARE).toBe("square");
      expect(GripType.PENCIL).toBe("pencil");
      expect(GripType.CRADLE).toBe("cradle");
      expect(GripType.OPEN_PALM).toBe("open_palm");
      expect(GripType.RELEASE).toBe("release");
    });
  });

  describe("mirrorQuaternion", () => {
    it("negates Y and Z components for right-hand mirroring", () => {
      const left: [number, number, number, number] = [0.1, 0.2, 0.3, 0.9];
      const right = mirrorQuaternion(left);
      expect(right).toEqual([0.1, -0.2, -0.3, 0.9]);
    });

    it("identity quaternion mirrors to itself", () => {
      const identity: [number, number, number, number] = [0, 0, 0, 1];
      expect(mirrorQuaternion(identity)).toEqual([0, -0, -0, 1]);
    });

    it("double mirror returns original", () => {
      const original: [number, number, number, number] = [0.5, 0.3, -0.1, 0.8];
      const mirrored = mirrorQuaternion(original);
      const restored = mirrorQuaternion(mirrored);
      expect(restored).toEqual(original);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/3d-animation/GripPose.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create GripPose.ts**

```typescript
// src/lib/shared/3d/domain/models/GripPose.ts
import type { Bone } from "three";

/** All grip types for staff manipulation */
export enum GripType {
  /** Relaxed open hand, fingers slightly curled. Default/idle. */
  IDLE = "idle",
  /** Full palm wrap around staff shaft. Wrist-driven rotation. */
  SQUARE = "square",
  /** Thumb + index + middle pinch, ring/pinky relaxed. Finger-driven rotation. */
  PENCIL = "pencil",
  /** Light cradle in curved fingers, thumb alongside. Passive hold. */
  CRADLE = "cradle",
  /** Flat open palm, staff resting on top. Catches and plane transitions. */
  OPEN_PALM = "open_palm",
  /** All fingers released. Staff is airborne. */
  RELEASE = "release",
}

/** Finger bone names in canonical order. 15 per hand. */
export const FINGER_BONES = [
  "Thumb1", "Thumb2", "Thumb3",
  "Index1", "Index2", "Index3",
  "Middle1", "Middle2", "Middle3",
  "Ring1", "Ring2", "Ring3",
  "Pinky1", "Pinky2", "Pinky3",
] as const;

export type FingerBoneName = (typeof FINGER_BONES)[number];

/**
 * A grip pose: 15 quaternions [x, y, z, w], one per finger bone in FINGER_BONES order.
 * Authored for left hand. Right hand mirrors at application time.
 */
export interface GripPose {
  readonly name: string;
  readonly type: GripType;
  readonly rotations: readonly [number, number, number, number][];
}

/** Mapped finger bones for both hands. */
export interface FingerChains {
  left: Map<FingerBoneName, Bone>;
  right: Map<FingerBoneName, Bone>;
}

/**
 * Mirror a quaternion for right-hand application.
 * Negates Y and Z components (reflection across the YZ plane).
 */
export function mirrorQuaternion(
  q: [number, number, number, number]
): [number, number, number, number] {
  return [q[0], -q[1], -q[2], q[3]];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/3d-animation/GripPose.test.ts`
Expected: PASS (all 6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/3d/domain/models/GripPose.ts tests/unit/3d-animation/GripPose.test.ts
git commit -m "feat(3d): add GripPose data types — GripType enum, FINGER_BONES, FingerChains, mirrorQuaternion"
```

---

### Task 2: Extend SkeletonState with Finger Chains

**Files:**
- Modify: `src/lib/shared/3d/services/contracts/IAvatarSkeletonBuilder.ts:61-73` (SkeletonState interface)
- Modify: `src/lib/shared/3d/services/implementations/AvatarSkeletonBuilder.ts:63-71` (state init), `170-238` (finger skip + bone mapping)

- [ ] **Step 1: Add `fingerChains` to SkeletonState interface**

In `IAvatarSkeletonBuilder.ts`, add import and field:

```typescript
// Add import at top (after existing imports):
import type { FingerChains } from "../../domain/models/GripPose";

// Add to SkeletonState interface (after rightArmChain):
  /** Mapped finger bone chains. Null if model lacks finger bones. */
  fingerChains: FingerChains | null;
```

- [ ] **Step 2: Initialize fingerChains in AvatarSkeletonBuilder state**

In `AvatarSkeletonBuilder.ts` line 64-71, add `fingerChains: null` to the initial state:

```typescript
private state: SkeletonState = {
  isLoaded: false,
  root: null,
  meshes: [],
  bones: new Map(),
  leftArmChain: null,
  rightArmChain: null,
  fingerChains: null,
};
```

- [ ] **Step 3: Add FINGER_BONE_ALIASES map**

In `AvatarSkeletonBuilder.ts`, after the existing `BONE_NAME_ALIASES` (after line 61), add:

```typescript
import {
  FINGER_BONES,
  type FingerBoneName,
  type FingerChains,
} from "../../domain/models/GripPose";

/**
 * Finger bone alias map. Keys are "Hand" + side prefix + canonical name.
 * Mixamo uses: mixamorigLeftHandThumb1, mixamorigRightHandIndex2, etc.
 * characters3d.com uses: L_Thumb1, R_Index2, etc.
 */
const FINGER_BONE_ALIASES: Record<string, string[]> = {};

// Build aliases for both hands and all 15 finger bones
for (const side of ["Left", "Right"] as const) {
  const prefix = side === "Left" ? "L" : "R";
  for (const bone of FINGER_BONES) {
    // e.g. "LeftThumb1" → ["LeftHandThumb1", "L_Thumb1", "thumb1_l", "thumb.01.L"]
    const key = `${side}${bone}`;
    FINGER_BONE_ALIASES[key] = [
      `${side}Hand${bone}`,        // Mixamo: LeftHandThumb1
      `${prefix}_${bone}`,          // characters3d.com: L_Thumb1
      `${bone.toLowerCase()}_${prefix.toLowerCase()}`, // Unreal: thumb1_l
    ];
  }
}
```

- [ ] **Step 4: Remove finger skip logic from mapBoneToMap**

In `AvatarSkeletonBuilder.ts`, remove lines 173-182 (the finger bone skip block in `mapBoneToMap`):

```typescript
// DELETE this block:
    // Skip finger bones
    if (
      boneName.includes("thumb") ||
      boneName.includes("index") ||
      boneName.includes("middle") ||
      boneName.includes("ring") ||
      boneName.includes("pinky")
    ) {
      return;
    }
```

The existing alias matching will now just not find finger bones in `BONE_NAME_ALIASES` (which only has body bones), so they'll fall through harmlessly. Finger bones get their own mapping step.

- [ ] **Step 5: Remove finger skip logic from mapBone (dead code)**

In `AvatarSkeletonBuilder.ts`, remove lines 208-217 (the finger bone skip block in `mapBone`). This method is dead code (never called by processGLTF), but clean it up for consistency.

- [ ] **Step 6: Add buildFingerChains method**

Add a new private method to `AvatarSkeletonBuilder`:

```typescript
/**
 * Map finger bones from the skeleton into FingerChains.
 * Returns null if any of the 30 bones (15 per hand) are missing.
 */
private buildFingerChains(root: Object3D): FingerChains | null {
  const left = new Map<FingerBoneName, Bone>();
  const right = new Map<FingerBoneName, Bone>();

  // Detect prefix (e.g. "mixamorig") used by this skeleton
  let prefix = "";
  root.traverse((obj) => {
    if (obj.name.includes("Hips")) {
      const idx = obj.name.indexOf("Hips");
      prefix = obj.name.slice(0, idx);
    }
  });

  for (const boneName of FINGER_BONES) {
    // Try each alias for left hand
    const leftKey = `Left${boneName}`;
    const leftAliases = FINGER_BONE_ALIASES[leftKey] ?? [];
    let leftBone: Bone | null = null;

    for (const alias of leftAliases) {
      // Try with detected prefix first, then without
      const withPrefix = root.getObjectByName(`${prefix}${alias}`);
      const without = root.getObjectByName(alias);
      const found = withPrefix ?? without;
      if (found && (found as Bone).isBone) {
        leftBone = found as Bone;
        break;
      }
    }

    // Try each alias for right hand
    const rightKey = `Right${boneName}`;
    const rightAliases = FINGER_BONE_ALIASES[rightKey] ?? [];
    let rightBone: Bone | null = null;

    for (const alias of rightAliases) {
      const withPrefix = root.getObjectByName(`${prefix}${alias}`);
      const without = root.getObjectByName(alias);
      const found = withPrefix ?? without;
      if (found && (found as Bone).isBone) {
        rightBone = found as Bone;
        break;
      }
    }

    if (!leftBone || !rightBone) {
      // Model lacks complete finger bones — degrade gracefully
      return null;
    }

    left.set(boneName, leftBone);
    right.set(boneName, rightBone);
  }

  return { left, right };
}
```

- [ ] **Step 7: Call buildFingerChains in processGLTF**

In `processGLTF()`, after `this.buildArmChains();` (currently line 143), add:

```typescript
    // Build finger bone chains (may be null if model lacks finger bones)
    this.state.fingerChains = this.buildFingerChains(gltf.scene);
```

- [ ] **Step 8: Run typecheck**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No new errors (existing errors unrelated to this change are fine)

- [ ] **Step 9: Commit**

```bash
git add src/lib/shared/3d/services/contracts/IAvatarSkeletonBuilder.ts src/lib/shared/3d/services/implementations/AvatarSkeletonBuilder.ts
git commit -m "feat(3d): map finger bones from GLTF skeleton — 30 bones (15 per hand) with Mixamo/characters3d alias support"
```

---

### Task 3: IFingerAnimator Interface

**Files:**
- Create: `src/lib/shared/3d/services/contracts/IFingerAnimator.ts`

- [ ] **Step 1: Create the interface**

```typescript
// src/lib/shared/3d/services/contracts/IFingerAnimator.ts
import type { GripType, FingerChains } from "../../domain/models/GripPose";

/**
 * Animates finger bones by slerping between grip pose presets.
 * Peer to ILegAnimator — operates on disjoint bone sets.
 * Instantiated per-avatar (not a DI singleton).
 */
export interface IFingerAnimator {
  /** Bind to a skeleton's finger bone chains. Call after model loads. */
  initialize(fingerChains: FingerChains): void;

  /** Whether initialize() has been called with valid finger chains. */
  isReady(): boolean;

  /** Set the target grip for one hand. Animator slerps toward it. */
  setGrip(hand: "left" | "right", type: GripType): void;

  /** Set both hands at once. */
  setGrips(leftGrip: GripType, rightGrip: GripType): void;

  /** Advance animation by deltaTime seconds. Apply bone rotations. */
  update(deltaTime: number): void;

  /** Blend speed in units/sec. 1.0 = 1s transition, 6.0 = ~170ms. Default 6.0. */
  setBlendSpeed(speed: number): void;

  /** Current grip type for a hand. */
  getCurrentGrip(hand: "left" | "right"): GripType;

  /** Release bone references. */
  dispose(): void;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/shared/3d/services/contracts/IFingerAnimator.ts
git commit -m "feat(3d): add IFingerAnimator interface"
```

---

### Task 4: Staff Grip Pose Presets (IDLE + SQUARE)

**Files:**
- Create: `src/lib/shared/3d/data/grip-poses/staff-grip-poses.ts`
- Test: `tests/unit/3d-animation/staff-grip-poses.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// tests/unit/3d-animation/staff-grip-poses.test.ts
import { describe, it, expect } from "vitest";
import { STAFF_GRIP_POSES } from "$lib/shared/3d/data/grip-poses/staff-grip-poses";
import { GripType, FINGER_BONES } from "$lib/shared/3d/domain/models/GripPose";

describe("STAFF_GRIP_POSES", () => {
  it("has an entry for every GripType", () => {
    for (const type of Object.values(GripType)) {
      expect(STAFF_GRIP_POSES[type]).toBeDefined();
      expect(STAFF_GRIP_POSES[type].type).toBe(type);
    }
  });

  it("every pose has exactly 15 quaternion rotations", () => {
    for (const pose of Object.values(STAFF_GRIP_POSES)) {
      expect(pose.rotations).toHaveLength(FINGER_BONES.length);
    }
  });

  it("every quaternion has 4 components", () => {
    for (const pose of Object.values(STAFF_GRIP_POSES)) {
      for (const q of pose.rotations) {
        expect(q).toHaveLength(4);
      }
    }
  });

  it("every quaternion is approximately unit length", () => {
    for (const pose of Object.values(STAFF_GRIP_POSES)) {
      for (const [x, y, z, w] of pose.rotations) {
        const len = Math.sqrt(x * x + y * y + z * z + w * w);
        expect(len).toBeCloseTo(1.0, 2);
      }
    }
  });

  it("IDLE pose has minimal finger curl", () => {
    const idle = STAFF_GRIP_POSES[GripType.IDLE];
    // W component should be close to 1 (near-identity) for idle
    for (const [, , , w] of idle.rotations) {
      expect(w).toBeGreaterThan(0.9);
    }
  });

  it("SQUARE pose has significant finger curl", () => {
    const square = STAFF_GRIP_POSES[GripType.SQUARE];
    // Index through Pinky bones (indices 3-14) should have meaningful rotation
    // (W < 0.95 means at least ~18 degrees of rotation)
    const fingerBones = square.rotations.slice(3); // Skip thumb (0-2)
    const hasCurl = fingerBones.some(([, , , w]) => w < 0.95);
    expect(hasCurl).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/3d-animation/staff-grip-poses.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create directory and staff-grip-poses.ts**

First create the directory:
```bash
mkdir -p src/lib/shared/3d/data/grip-poses
```

These are initial approximation values. IDLE is near-identity with slight natural curl. SQUARE has ~80-90deg curl on all four fingers around a cylindrical grip. Remaining types are placeholders (copies of IDLE) to be authored later via the debug editor.

```typescript
// src/lib/shared/3d/data/grip-poses/staff-grip-poses.ts
import { GripType, type GripPose } from "../../domain/models/GripPose";

// Quaternion helper: rotation of `degrees` around X axis → [x, y, z, w]
function xRot(degrees: number): [number, number, number, number] {
  const rad = (degrees * Math.PI) / 180;
  return [Math.sin(rad / 2), 0, 0, Math.cos(rad / 2)];
}

// Quaternion helper: rotation of `degrees` around Z axis
function zRot(degrees: number): [number, number, number, number] {
  const rad = (degrees * Math.PI) / 180;
  return [0, 0, Math.sin(rad / 2), Math.cos(rad / 2)];
}

const IDENTITY: [number, number, number, number] = [0, 0, 0, 1];

/** Relaxed idle — slight natural curl */
const IDLE_POSE: GripPose = {
  name: "Relaxed Idle",
  type: GripType.IDLE,
  rotations: [
    // Thumb: slight abduction (Z-axis)
    zRot(10),    // Thumb1
    zRot(5),     // Thumb2
    IDENTITY,    // Thumb3
    // Index: light curl
    xRot(10),    // Index1
    xRot(15),    // Index2
    xRot(10),    // Index3
    // Middle: slightly more curl
    xRot(12),    // Middle1
    xRot(18),    // Middle2
    xRot(12),    // Middle3
    // Ring: a bit more
    xRot(15),    // Ring1
    xRot(20),    // Ring2
    xRot(15),    // Ring3
    // Pinky: most curl at rest
    xRot(18),    // Pinky1
    xRot(22),    // Pinky2
    xRot(18),    // Pinky3
  ],
};

/** Square grip — full palm wrap around staff shaft (~80-90deg per joint) */
const SQUARE_POSE: GripPose = {
  name: "Square Staff Grip",
  type: GripType.SQUARE,
  rotations: [
    // Thumb: wraps around opposing side of staff
    zRot(35),    // Thumb1: abduct toward staff
    xRot(40),    // Thumb2: curl around
    xRot(30),    // Thumb3: tip contact
    // Index: strong curl around staff shaft
    xRot(75),    // Index1
    xRot(85),    // Index2
    xRot(60),    // Index3
    // Middle: similar curl
    xRot(78),    // Middle1
    xRot(88),    // Middle2
    xRot(62),    // Middle3
    // Ring: slightly tighter
    xRot(80),    // Ring1
    xRot(90),    // Ring2
    xRot(65),    // Ring3
    // Pinky: tightest curl (smallest finger, wraps more)
    xRot(82),    // Pinky1
    xRot(90),    // Pinky2
    xRot(68),    // Pinky3
  ],
};

export const STAFF_GRIP_POSES: Record<GripType, GripPose> = {
  [GripType.IDLE]: IDLE_POSE,
  [GripType.SQUARE]: SQUARE_POSE,
  // Placeholders — will be authored via debug editor
  [GripType.PENCIL]: { name: "Pencil Grip", type: GripType.PENCIL, rotations: [...IDLE_POSE.rotations] },
  [GripType.CRADLE]: { name: "Cradle", type: GripType.CRADLE, rotations: [...IDLE_POSE.rotations] },
  [GripType.OPEN_PALM]: { name: "Open Palm", type: GripType.OPEN_PALM, rotations: [...IDLE_POSE.rotations] },
  [GripType.RELEASE]: { name: "Release", type: GripType.RELEASE, rotations: [...IDLE_POSE.rotations] },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/3d-animation/staff-grip-poses.test.ts`
Expected: PASS (all 6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/3d/data/grip-poses/staff-grip-poses.ts tests/unit/3d-animation/staff-grip-poses.test.ts
git commit -m "feat(3d): add staff grip pose presets — IDLE and SQUARE authored, 4 placeholders"
```

---

### Task 5: FingerAnimator Implementation

**Files:**
- Create: `src/lib/shared/3d/services/implementations/FingerAnimator.ts`
- Test: `tests/unit/3d-animation/FingerAnimator.test.ts`

- [ ] **Step 1: Write the test**

The test exercises the state machine and blend logic without Three.js bones (mock the Bone quaternion interface).

```typescript
// tests/unit/3d-animation/FingerAnimator.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { FingerAnimator } from "$lib/shared/3d/services/implementations/FingerAnimator";
import { GripType, FINGER_BONES, type FingerChains, type FingerBoneName } from "$lib/shared/3d/domain/models/GripPose";
import { Quaternion } from "three";
import type { Bone } from "three";

/** Create a mock Bone with a real Three.js Quaternion */
function mockBone(name: string): Bone {
  return {
    name,
    isBone: true,
    quaternion: new Quaternion(0, 0, 0, 1),
  } as unknown as Bone;
}

/** Create mock FingerChains with 15 bones per hand */
function createMockChains(): FingerChains {
  const left = new Map<FingerBoneName, Bone>();
  const right = new Map<FingerBoneName, Bone>();
  for (const name of FINGER_BONES) {
    left.set(name, mockBone(`Left${name}`));
    right.set(name, mockBone(`Right${name}`));
  }
  return { left, right };
}

describe("FingerAnimator", () => {
  let animator: FingerAnimator;
  let chains: FingerChains;

  beforeEach(() => {
    animator = new FingerAnimator();
    chains = createMockChains();
  });

  it("isReady() returns false before initialize", () => {
    expect(animator.isReady()).toBe(false);
  });

  it("isReady() returns true after initialize", () => {
    animator.initialize(chains);
    expect(animator.isReady()).toBe(true);
  });

  it("defaults to IDLE grip for both hands", () => {
    animator.initialize(chains);
    expect(animator.getCurrentGrip("left")).toBe(GripType.IDLE);
    expect(animator.getCurrentGrip("right")).toBe(GripType.IDLE);
  });

  it("setGrip updates the target grip type", () => {
    animator.initialize(chains);
    animator.setGrip("left", GripType.SQUARE);
    expect(animator.getCurrentGrip("left")).toBe(GripType.SQUARE);
    expect(animator.getCurrentGrip("right")).toBe(GripType.IDLE);
  });

  it("setGrips updates both hands", () => {
    animator.initialize(chains);
    animator.setGrips(GripType.SQUARE, GripType.RELEASE);
    expect(animator.getCurrentGrip("left")).toBe(GripType.SQUARE);
    expect(animator.getCurrentGrip("right")).toBe(GripType.RELEASE);
  });

  it("update() modifies bone quaternions toward target pose", () => {
    animator.initialize(chains);
    animator.setGrip("left", GripType.SQUARE);

    // Get a finger bone to check
    const index1 = chains.left.get("Index1")!;
    const beforeW = index1.quaternion.w;

    // Run several frames to let slerp progress
    for (let i = 0; i < 60; i++) {
      animator.update(1 / 60);
    }

    // After 1 second at default blend speed (6.0), should be very close to target
    // SQUARE Index1 has ~75deg X rotation, so W should be notably less than 1.0
    expect(index1.quaternion.w).not.toBeCloseTo(beforeW, 1);
  });

  it("update() is a no-op before initialize", () => {
    // Should not throw
    animator.setGrip("left", GripType.SQUARE);
    animator.update(1 / 60);
  });

  it("dispose() makes isReady return false", () => {
    animator.initialize(chains);
    expect(animator.isReady()).toBe(true);
    animator.dispose();
    expect(animator.isReady()).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/3d-animation/FingerAnimator.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement FingerAnimator**

```typescript
// src/lib/shared/3d/services/implementations/FingerAnimator.ts
import { Quaternion } from "three";
import type { Bone } from "three";
import type { IFingerAnimator } from "../contracts/IFingerAnimator";
import {
  GripType,
  FINGER_BONES,
  mirrorQuaternion,
  type FingerBoneName,
  type FingerChains,
} from "../../domain/models/GripPose";
import { STAFF_GRIP_POSES } from "../../data/grip-poses/staff-grip-poses";

/** Per-hand animation state */
interface HandState {
  targetGrip: GripType;
  /** Current quaternion per bone (slerped each frame toward target) */
  currentRotations: Quaternion[];
  /** Bone references in FINGER_BONES order */
  bones: Bone[];
}

export class FingerAnimator implements IFingerAnimator {
  private leftHand: HandState | null = null;
  private rightHand: HandState | null = null;
  private blendSpeed = 6.0;
  private ready = false;
  /** Scratch quaternion reused in updateHand to avoid per-frame allocations */
  private readonly scratchQuat = new Quaternion();

  initialize(fingerChains: FingerChains): void {
    this.leftHand = this.createHandState(fingerChains.left, "left");
    this.rightHand = this.createHandState(fingerChains.right, "right");
    this.ready = true;

    // Snap to IDLE pose immediately (no blend on first init)
    this.applyPoseImmediate(this.leftHand, GripType.IDLE, "left");
    this.applyPoseImmediate(this.rightHand, GripType.IDLE, "right");
  }

  isReady(): boolean {
    return this.ready;
  }

  setGrip(hand: "left" | "right", type: GripType): void {
    const state = hand === "left" ? this.leftHand : this.rightHand;
    if (state) {
      state.targetGrip = type;
    }
  }

  setGrips(leftGrip: GripType, rightGrip: GripType): void {
    this.setGrip("left", leftGrip);
    this.setGrip("right", rightGrip);
  }

  update(deltaTime: number): void {
    if (!this.ready || !this.leftHand || !this.rightHand) return;

    this.updateHand(this.leftHand, "left", deltaTime);
    this.updateHand(this.rightHand, "right", deltaTime);
  }

  setBlendSpeed(speed: number): void {
    this.blendSpeed = speed;
  }

  getCurrentGrip(hand: "left" | "right"): GripType {
    const state = hand === "left" ? this.leftHand : this.rightHand;
    return state?.targetGrip ?? GripType.IDLE;
  }

  dispose(): void {
    this.leftHand = null;
    this.rightHand = null;
    this.ready = false;
  }

  // --- Private ---

  private createHandState(
    boneMap: Map<FingerBoneName, Bone>,
    _hand: "left" | "right"
  ): HandState {
    const bones: Bone[] = [];
    const currentRotations: Quaternion[] = [];

    for (const boneName of FINGER_BONES) {
      const bone = boneMap.get(boneName);
      if (!bone) {
        throw new Error(`Missing finger bone: ${boneName}`);
      }
      bones.push(bone);
      currentRotations.push(new Quaternion(0, 0, 0, 1));
    }

    return {
      targetGrip: GripType.IDLE,
      currentRotations,
      bones,
    };
  }

  /** Write the target quaternion for a bone into scratchQuat, mirroring for right hand */
  private writeTargetRotation(
    gripType: GripType,
    boneIndex: number,
    hand: "left" | "right"
  ): void {
    const pose = STAFF_GRIP_POSES[gripType];
    const raw = pose.rotations[boneIndex];
    if (hand === "right") {
      // Mirror: negate Y and Z
      this.scratchQuat.set(raw[0], -raw[1], -raw[2], raw[3]);
    } else {
      this.scratchQuat.set(raw[0], raw[1], raw[2], raw[3]);
    }
  }

  /** Slerp each bone toward target pose (zero allocations per frame) */
  private updateHand(
    state: HandState,
    hand: "left" | "right",
    deltaTime: number
  ): void {
    const alpha = Math.min(1, this.blendSpeed * deltaTime);

    for (let i = 0; i < FINGER_BONES.length; i++) {
      this.writeTargetRotation(state.targetGrip, i, hand);
      state.currentRotations[i].slerp(this.scratchQuat, alpha);
      state.bones[i].quaternion.copy(state.currentRotations[i]);
    }
  }

  /** Snap to a pose without blending (used on initialize) */
  private applyPoseImmediate(
    state: HandState,
    gripType: GripType,
    hand: "left" | "right"
  ): void {
    state.targetGrip = gripType;
    for (let i = 0; i < FINGER_BONES.length; i++) {
      this.writeTargetRotation(gripType, i, hand);
      state.currentRotations[i].copy(this.scratchQuat);
      state.bones[i].quaternion.copy(this.scratchQuat);
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/3d-animation/FingerAnimator.test.ts`
Expected: PASS (all 7 tests)

- [ ] **Step 5: Run full test suite**

Run: `npx vitest run tests/unit/3d-animation/`
Expected: All tests pass (existing + new)

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/3d/services/implementations/FingerAnimator.ts tests/unit/3d-animation/FingerAnimator.test.ts
git commit -m "feat(3d): implement FingerAnimator — quaternion slerp between grip poses, per-hand independent blending"
```

---

### Task 6: Wire FingerAnimator into Avatar3D

**Files:**
- Modify: `src/lib/shared/3d/components/Avatar3D.svelte:207-237` (onMount), `170-188` (loadAvatar), `265-332` (useTask loop)

- [ ] **Step 1: Add imports to Avatar3D.svelte**

At the top of the `<script>` block, add:

```typescript
import { FingerAnimator } from "$lib/shared/3d/services/implementations/FingerAnimator";
import { GripType } from "$lib/shared/3d/domain/models/GripPose";
```

- [ ] **Step 2: Add fingerAnimator variable**

Near the other service variable declarations (around where `legAnimator` is declared):

```typescript
let fingerAnimator: FingerAnimator | null = null;
```

- [ ] **Step 3: Instantiate FingerAnimator in onMount**

In the `onMount` block (lines 215-229), after `legAnimator = legs;` (line 227):

```typescript
      const fingers = new FingerAnimator();
      fingerAnimator = fingers;
```

- [ ] **Step 4: Initialize finger chains after model load**

In the `loadAvatar` function, after the leg animator initialization block (after line 188), add:

```typescript
      // Initialize finger animator with mapped finger chains
      if (fingerAnimator) {
        const skeletonState = skeletonService.getState();
        if (skeletonState.fingerChains) {
          fingerAnimator.initialize(skeletonState.fingerChains);
        }
      }
```

- [ ] **Step 5: Add finger update to useTask loop**

In the `useTask` callback (after `legAnimator.update(delta);` on line 330), add:

```typescript
    // Update finger grip animation
    if (fingerAnimator?.isReady()) {
      const leftGrip = bluePropState ? GripType.SQUARE : GripType.IDLE;
      const rightGrip = redPropState ? GripType.SQUARE : GripType.IDLE;
      fingerAnimator.setGrips(leftGrip, rightGrip);
      fingerAnimator.update(delta);
    }
```

- [ ] **Step 6: Add cleanup to onDestroy**

In the existing `onDestroy` block (lines 351-361), after the `legAnimator.dispose()` call:

```typescript
    // Dispose finger animator
    if (fingerAnimator) {
      fingerAnimator.dispose();
    }
```

- [ ] **Step 7: Run typecheck**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No new errors from Avatar3D.svelte

- [ ] **Step 8: Run build**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds

- [ ] **Step 9: Commit**

```bash
git add src/lib/shared/3d/components/Avatar3D.svelte
git commit -m "feat(3d): wire FingerAnimator into Avatar3D frame loop — hands grip staff on hold, idle on release"
```

---

### Task 7: Update PropState3D and IAvatarAnimator Stubs

**Files:**
- Modify: `src/lib/shared/3d/domain/models/PropState3D.ts:27-34`
- Modify: `src/lib/shared/3d/services/contracts/IAvatarAnimator.ts:19-20`

- [ ] **Step 1: Add gripType to PropState3D**

In `PropState3D.ts`, add import and field:

```typescript
// Add import:
import type { GripType } from "./GripPose";

// Add to PropState3D interface (after worldRotation):
  /** Grip type for the hand holding this prop. Scaffolding for Phase 3. */
  gripType?: GripType;
```

- [ ] **Step 2: Update IAvatarAnimator gripType stub**

In `IAvatarAnimator.ts` line 19-20, replace the string literal stub:

```typescript
  /** Grip type for fingers — see GripType enum in GripPose.ts */
  gripType?: import("../../domain/models/GripPose").GripType;
```

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/3d/domain/models/PropState3D.ts src/lib/shared/3d/services/contracts/IAvatarAnimator.ts
git commit -m "feat(3d): add gripType field to PropState3D and update IAvatarAnimator stub"
```

---

### Task 8: Hand Pose Debug Editor (Lab Tab)

**Files:**
- Create: `src/lib/features/lab/tabs/hand-pose-editor/HandPoseEditor.svelte`
- Create: `src/lib/features/lab/tabs/hand-pose-editor/FingerSliderGroup.svelte`
- Modify: `src/lib/features/lab/LabModule.svelte:17-39` (tabComponents)
- Modify: `src/lib/shared/navigation/config/tab-definitions.ts` (LAB_TABS)

- [ ] **Step 0: Create directory**

```bash
mkdir -p src/lib/features/lab/tabs/hand-pose-editor
```

- [ ] **Step 1: Create FingerSliderGroup.svelte**

```svelte
<!--
  FingerSliderGroup.svelte — Sliders for one finger's 3 bone rotations.
  Thumb shows Y/Z sliders by default (abduction). Other fingers show X (flexion).
-->
<script lang="ts">
  import { Quaternion, Euler } from "three";

  interface Props {
    fingerName: string;
    /** Whether this finger is the thumb (different default axes) */
    isThumb?: boolean;
    /** Current rotation values as euler angles (degrees) per bone */
    rotations: { x: number; y: number; z: number }[];
    /** Callback when any slider changes */
    onchange: (boneIndex: number, axis: "x" | "y" | "z", degrees: number) => void;
  }

  let { fingerName, isThumb = false, rotations, onchange }: Props = $props();

  let showAllAxes = $state(false);

  const boneLabels = ["Base", "Mid", "Tip"];
</script>

<div class="finger-group">
  <div class="finger-header">
    <span class="finger-name">{fingerName}</span>
    <button
      class="axis-toggle"
      onclick={() => (showAllAxes = !showAllAxes)}
    >
      {showAllAxes ? "Simple" : "All Axes"}
    </button>
  </div>

  {#each boneLabels as label, i}
    <div class="bone-row">
      <span class="bone-label">{label}</span>

      {#if isThumb || showAllAxes}
        <label class="slider-label">
          Y
          <input
            type="range"
            min="-90"
            max="90"
            step="1"
            value={rotations[i].y}
            oninput={(e) => onchange(i, "y", Number(e.currentTarget.value))}
          />
          <span class="value">{rotations[i].y}°</span>
        </label>
        <label class="slider-label">
          Z
          <input
            type="range"
            min="-90"
            max="90"
            step="1"
            value={rotations[i].z}
            oninput={(e) => onchange(i, "z", Number(e.currentTarget.value))}
          />
          <span class="value">{rotations[i].z}°</span>
        </label>
      {/if}

      <label class="slider-label">
        X
        <input
          type="range"
          min="-10"
          max="120"
          step="1"
          value={rotations[i].x}
          oninput={(e) => onchange(i, "x", Number(e.currentTarget.value))}
        />
        <span class="value">{rotations[i].x}°</span>
      </label>
    </div>
  {/each}
</div>

<style>
  .finger-group {
    padding: 8px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 6px;
    margin-bottom: 8px;
  }

  .finger-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
  }

  .finger-name {
    font-weight: 600;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text, #fff);
  }

  .axis-toggle {
    font-size: var(--font-size-compact, 12px);
    padding: 2px 8px;
    border-radius: 4px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    background: transparent;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    cursor: pointer;
  }

  .bone-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 2px;
  }

  .bone-label {
    width: 30px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
  }

  .slider-label {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    flex: 1;
  }

  input[type="range"] {
    flex: 1;
    height: 4px;
    accent-color: var(--theme-accent, #8b5cf6);
  }

  .value {
    width: 36px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
</style>
```

- [ ] **Step 2: Create HandPoseEditor.svelte**

This is the main editor component. It loads a GLTF avatar, maps finger bones, and provides sliders + JSON export.

```svelte
<!--
  HandPoseEditor.svelte — Debug tool for authoring finger grip poses.
  Renders a close-up hand with per-joint sliders and "Copy as JSON" export.
  Lab tab only — not part of production build.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { Canvas } from "@threlte/core";
  import { T } from "@threlte/core";
  import { OrbitControls } from "@threlte/extras";
  import { Euler, Quaternion } from "three";
  import { AvatarSkeletonBuilder } from "$lib/shared/3d/services/implementations/AvatarSkeletonBuilder";
  import { FINGER_BONES, GripType, type FingerBoneName } from "$lib/shared/3d/domain/models/GripPose";
  import { STAFF_GRIP_POSES } from "$lib/shared/3d/data/grip-poses/staff-grip-poses";
  import FingerSliderGroup from "./FingerSliderGroup.svelte";
  import { AVATAR_DEFINITIONS } from "$lib/shared/3d/config/avatar-definitions";

  const FINGERS = ["Thumb", "Index", "Middle", "Ring", "Pinky"] as const;

  // Euler angles (degrees) for each of the 15 bones
  let eulerAngles = $state<{ x: number; y: number; z: number }[]>(
    FINGER_BONES.map(() => ({ x: 0, y: 0, z: 0 }))
  );

  let skeleton: AvatarSkeletonBuilder | null = $state(null);
  let cachedRoot = $state<any>(null);
  let selectedPreset = $state<GripType>(GripType.IDLE);
  let copied = $state(false);

  onMount(async () => {
    const skel = new AvatarSkeletonBuilder();
    // Load a default model (X-Bot)
    const defaultModel = AVATAR_DEFINITIONS[0];
    if (defaultModel) {
      await skel.loadModel(defaultModel.modelPath);
      cachedRoot = skel.getRoot();
      skeleton = skel;
      loadPreset(GripType.IDLE);
    }
  });

  function loadPreset(type: GripType) {
    selectedPreset = type;
    const pose = STAFF_GRIP_POSES[type];

    eulerAngles = pose.rotations.map(([x, y, z, w]) => {
      const euler = new Euler();
      euler.setFromQuaternion(new Quaternion(x, y, z, w));
      return {
        x: Math.round((euler.x * 180) / Math.PI),
        y: Math.round((euler.y * 180) / Math.PI),
        z: Math.round((euler.z * 180) / Math.PI),
      };
    });

    applyToBones();
  }

  function handleSliderChange(fingerIndex: number, boneInFinger: number, axis: "x" | "y" | "z", degrees: number) {
    const globalIndex = fingerIndex * 3 + boneInFinger;
    eulerAngles[globalIndex] = { ...eulerAngles[globalIndex], [axis]: degrees };
    applyToBones();
  }

  function applyToBones() {
    if (!skeleton) return;
    const state = skeleton.getState();
    if (!state.fingerChains) return;

    for (let i = 0; i < FINGER_BONES.length; i++) {
      const boneName = FINGER_BONES[i];
      const bone = state.fingerChains.left.get(boneName);
      if (!bone) continue;

      const angles = eulerAngles[i];
      const euler = new Euler(
        (angles.x * Math.PI) / 180,
        (angles.y * Math.PI) / 180,
        (angles.z * Math.PI) / 180
      );
      bone.quaternion.setFromEuler(euler);
    }
  }

  function copyAsJson() {
    const rotations = eulerAngles.map((angles) => {
      const euler = new Euler(
        (angles.x * Math.PI) / 180,
        (angles.y * Math.PI) / 180,
        (angles.z * Math.PI) / 180
      );
      const q = new Quaternion().setFromEuler(euler);
      // Round to 3 decimal places
      return [
        Math.round(q.x * 1000) / 1000,
        Math.round(q.y * 1000) / 1000,
        Math.round(q.z * 1000) / 1000,
        Math.round(q.w * 1000) / 1000,
      ] as [number, number, number, number];
    });

    navigator.clipboard.writeText(JSON.stringify(rotations, null, 2));
    copied = true;
    setTimeout(() => (copied = false), 2000);
  }

  function resetAll() {
    eulerAngles = FINGER_BONES.map(() => ({ x: 0, y: 0, z: 0 }));
    applyToBones();
  }
</script>

<div class="editor-layout">
  <div class="viewport">
    <Canvas>
      <T.PerspectiveCamera makeDefault position={[0.3, 1.0, 0.4]} fov={45}>
        <OrbitControls target={[0, 0.9, 0]} />
      </T.PerspectiveCamera>

      <T.AmbientLight intensity={0.6} />
      <T.DirectionalLight position={[2, 3, 1]} intensity={1} />

      <!-- Staff reference cylinder -->
      <T.Mesh position={[0, 0.9, -0.15]} rotation={[Math.PI / 2, 0, 0]}>
        <T.CylinderGeometry args={[0.012, 0.012, 0.8, 8]} />
        <T.MeshStandardMaterial color="#888888" />
      </T.Mesh>

      {#if cachedRoot}
        <T is={cachedRoot} />
      {/if}
    </Canvas>
  </div>

  <div class="controls">
    <div class="toolbar">
      <select
        value={selectedPreset}
        onchange={(e) => loadPreset(e.currentTarget.value as GripType)}
      >
        {#each Object.values(GripType) as type}
          <option value={type}>{STAFF_GRIP_POSES[type].name}</option>
        {/each}
      </select>

      <button onclick={copyAsJson}>
        {copied ? "Copied!" : "Copy JSON"}
      </button>

      <button onclick={resetAll}>Reset</button>
    </div>

    <div class="sliders">
      {#each FINGERS as finger, fi}
        <FingerSliderGroup
          fingerName={finger}
          isThumb={finger === "Thumb"}
          rotations={eulerAngles.slice(fi * 3, fi * 3 + 3)}
          onchange={(boneIndex, axis, degrees) =>
            handleSliderChange(fi, boneIndex, axis, degrees)
          }
        />
      {/each}
    </div>
  </div>
</div>

<style>
  .editor-layout {
    display: grid;
    grid-template-columns: 1fr 320px;
    height: 100%;
    gap: 0;
  }

  .viewport {
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    min-height: 400px;
  }

  .controls {
    overflow-y: auto;
    padding: 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-left: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .toolbar {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  }

  .toolbar select,
  .toolbar button {
    padding: 6px 12px;
    border-radius: 6px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    color: var(--theme-text, #fff);
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
  }

  .sliders {
    display: flex;
    flex-direction: column;
  }
</style>
```

- [ ] **Step 3: Register the lab tab in LabModule.svelte**

In `LabModule.svelte` line 17-39 `tabComponents`, add:

```typescript
    "hand-pose": () => import("./tabs/hand-pose-editor/HandPoseEditor.svelte"),
```

- [ ] **Step 4: Register the tab definition in tab-definitions.ts**

In `tab-definitions.ts`, find `LAB_TABS` and add a new entry (alphabetically):

```typescript
  {
    id: "hand-pose",
    label: "Hand Pose",
    icon: '<i class="fas fa-hand-paper" aria-hidden="true"></i>',
    description: "Author finger grip poses for 3D avatars",
    color: "#f59e0b",
    gradient: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)",
  },
```

- [ ] **Step 5: Run build to verify**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/lab/tabs/hand-pose-editor/ src/lib/features/lab/LabModule.svelte src/lib/shared/navigation/config/tab-definitions.ts
git commit -m "feat(lab): add Hand Pose Editor — per-joint sliders, preset load, JSON export for authoring grip poses"
```

---

### Task 9: Verify End-to-End

This task is manual verification. The implementing agent should follow the verification protocol.

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass, including the 3 new test files

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit --pretty 2>&1 | head -50`
Expected: No new errors

- [ ] **Step 3: Run build**

Run: `npm run build 2>&1 | tail -10`
Expected: Clean build

- [ ] **Step 4: Visual verification**

Navigate to a museum performer station or any scene with an Avatar3D holding a staff:
1. Verify hands are visibly gripping the staff (fingers curled, not flat)
2. Remove the prop (if possible) and verify hands return to idle pose smoothly
3. Check that multiple avatars (collaboration room) each animate independently

If Playwright/CDP is available, take a screenshot. If not, state: "I cannot verify this visually. Please check that avatar hands are gripping the staff in the museum performer stations."

- [ ] **Step 5: Verify lab tab**

Navigate to Lab module → Hand Pose tab:
1. Verify the 3D viewport renders a hand
2. Verify sliders move finger bones visually
3. Click "Copy JSON" and verify clipboard contains a 15-element quaternion array
4. Load the SQUARE preset and verify fingers curl

- [ ] **Step 6: Final commit (if any fixes needed)**

If any fixes were required during verification, commit them.
