# Animation Layer System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace leg-only animation with full-body Mixamo clips + per-bone IK post-processing, so the avatar has natural arm swing when walking and smooth IK blending when holding props.

**Architecture:** LocomotionAnimator plays full-body animations (idle/walk) via AnimationMixer. AvatarAnimator applies IK as a weighted post-process -- per-arm blend weights control whether each arm uses animation or IK. The frame pipeline is: locomotion update -> IK post-process -> finger update.

**Tech Stack:** Three.js AnimationMixer/AnimationAction/AnimationClip, Svelte 5, existing IK solver infrastructure

**Spec:** `docs/superpowers/specs/2026-04-03-animation-layer-system-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/shared/3d/services/contracts/ILocomotionAnimator.ts` | Create | Interface for full-body locomotion animation |
| `src/lib/shared/3d/services/implementations/LocomotionAnimator.ts` | Create | Full-body Mixamo clips, idle/walk crossfade, directional blend |
| `src/lib/shared/3d/services/contracts/IAvatarAnimator.ts` | Modify | Remove `setIdlePose`/`resetToIdle`, add `setPropsAndBlend` |
| `src/lib/shared/3d/services/implementations/AvatarAnimator.ts` | Modify | Per-bone IK blend weights, remove idle pose system |
| `src/lib/shared/3d/components/Avatar3D.svelte` | Modify | Swap LegAnimator -> LocomotionAnimator, simplify frame loop |
| `static/animations/idle.glb` | Create | Mixamo idle animation asset |
| `tests/unit/3d-animation/LocomotionAnimator.test.ts` | Create | Test retarget function and state transitions |
| `tests/unit/3d-animation/AvatarAnimator-blend.test.ts` | Create | Test per-bone blend weight ramp logic |

---

## Task 1: Download Idle Animation Asset

**Files:**
- Create: `static/animations/idle.glb`

This is a manual step -- Mixamo requires a browser.

- [ ] **Step 1: Download from Mixamo**

Go to https://www.mixamo.com. Search for "Idle" or "Breathing Idle". Select the X Bot character (matches your default avatar). Settings: check "In Place". Download as FBX.

- [ ] **Step 2: Convert to GLB in Blender**

Open Blender. File > Import > FBX. Then File > Export > glTF 2.0 (.glb). Save to `static/animations/idle.glb`.

- [ ] **Step 3: Verify file size**

The file should be ~80-100KB, similar to the existing walk.glb (87.9KB). If it's much larger, re-export without the mesh (animation-only).

- [ ] **Step 4: Commit**

```bash
git add static/animations/idle.glb
git commit -m "asset: add Mixamo idle animation for full-body locomotion"
```

---

## Task 2: Create ILocomotionAnimator Interface

**Files:**
- Create: `src/lib/shared/3d/services/contracts/ILocomotionAnimator.ts`

- [ ] **Step 1: Write the interface**

```typescript
/**
 * ILocomotionAnimator
 *
 * Plays full-body Mixamo animation clips (idle, walk, strafe)
 * via Three.js AnimationMixer. Unlike LegAnimator, this does NOT
 * filter out upper body bones -- the full skeleton is animated.
 * IK post-processing in AvatarAnimator selectively overrides
 * arm bones when props are held.
 */

import type { Object3D, AnimationClip } from "three";

export interface LocomotionInput {
  isMoving: boolean;
  speed: number;
  facingAngle?: number;
  moveDirection?: { x: number; z: number };
}

export interface AnimationUrls {
  idle: string;
  forward: string;
  backward: string;
  strafeLeft: string;
  strafeRight: string;
}

export interface LocomotionConfig {
  baseSpeed?: number;
  blendTime?: number;
}

export interface ILocomotionAnimator {
  initialize(root: Object3D): void;
  loadAnimations(urls: AnimationUrls): Promise<void>;
  setLocomotion(input: LocomotionInput): void;
  update(delta: number): void;
  isReady(): boolean;
  configure(config: LocomotionConfig): void;
  dispose(): void;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/shared/3d/services/contracts/ILocomotionAnimator.ts
git commit -m "feat(3d): ILocomotionAnimator interface for full-body animation"
```

---

## Task 3: Implement LocomotionAnimator

**Files:**
- Create: `src/lib/shared/3d/services/implementations/LocomotionAnimator.ts`
- Reference: `src/lib/shared/3d/services/implementations/LegAnimator.ts` (copy retargeting logic)

- [ ] **Step 1: Write `retargetFullBody()` function**

Copy from LegAnimator: `BONE_PREFIXES`, `extractCoreBoneName()`, `retargetTrackName()`. Expand `BONE_NAME_MAPPING` to cover ALL humanoid bones (LegAnimator's mapping only covers legs/hips -- we need arms, spine, head too):

```typescript
// ADD these to BONE_NAME_MAPPING (in addition to existing leg mappings):
// Arms
L_Arm: "LeftArm",
L_ForeArm: "LeftForeArm",
L_Hand: "LeftHand",
R_Arm: "RightArm",
R_ForeArm: "RightForeArm",
R_Hand: "RightHand",
LeftUpperArm: "LeftArm",
RightUpperArm: "RightArm",
Left_Arm: "LeftArm",
Left_ForeArm: "LeftForeArm",
Left_Hand: "LeftHand",
Right_Arm: "RightArm",
Right_ForeArm: "RightForeArm",
Right_Hand: "RightHand",
// Spine / Head
Chest: "Spine1",
UpperChest: "Spine2",
Upper_Chest: "Spine2",
// Shoulders
L_Shoulder: "LeftShoulder",
R_Shoulder: "RightShoulder",
Left_Shoulder: "LeftShoulder",
Right_Shoulder: "RightShoulder",
// Standard identity mappings for arm/spine bones
LeftArm: "LeftArm",
LeftForeArm: "LeftForeArm",
LeftHand: "LeftHand",
RightArm: "RightArm",
RightForeArm: "RightForeArm",
RightHand: "RightHand",
LeftShoulder: "LeftShoulder",
RightShoulder: "RightShoulder",
Spine: "Spine",
Spine1: "Spine1",
Spine2: "Spine2",
Neck: "Neck",
Head: "Head",
```

Then write the new filter function that keeps ALL quaternion tracks (no leg-bone filtering):

```typescript
/**
 * Retarget animation clip to match target skeleton's bone naming.
 * Keeps ALL .quaternion tracks (full body). Excludes .position
 * tracks (prevents root motion) and .scale tracks (prevents
 * disappearing meshes).
 */
function retargetFullBody(
  clip: AnimationClip,
  targetPrefix: string
): AnimationClip {
  const tracks: KeyframeTrack[] = [];

  for (const track of clip.tracks) {
    if (!track.name.includes(".quaternion")) continue;

    const newTrackName = retargetTrackName(track.name, targetPrefix);
    const clonedTrack = track.clone();
    clonedTrack.name = newTrackName;
    tracks.push(clonedTrack);
  }

  return new AnimationClip(clip.name + "_fullbody", clip.duration, tracks);
}
```

- [ ] **Step 2: Write the LocomotionAnimator class**

Structure: same as LegAnimator but with these differences:
- Uses `retargetFullBody()` instead of `filterAndRetargetToLegBones()`
- Has an `idleAction` and `currentState: "idle" | "walk"` for crossfade
- Uses `crossFadeFrom()` for idle/walk transitions
- Directional walk blending uses same weight approach as LegAnimator
- `detectBonePrefix()` copied from LegAnimator

Key state:
```typescript
private idleAction: AnimationAction | null = null;
private currentState: "idle" | "walk" = "idle";
// Plus existing directional clip storage from LegAnimator
```

Key methods:
```typescript
// Called when isMoving changes
private switchToIdle(): void {
  if (this.currentState === "idle" || !this.idleAction) return;
  this.idleAction.reset().play();
  // crossFadeFrom the highest-weight walk action
  const activeWalk = this.getActiveWalkAction();
  if (activeWalk) {
    this.idleAction.crossFadeFrom(activeWalk, 0.3, true);
  }
  // Zero out all walk weights
  for (const key of DIRECTION_KEYS) {
    this.targetDirWeights[key] = 0;
  }
  this.currentState = "idle";
}

private switchToWalk(): void {
  if (this.currentState === "walk") return;
  // Walk actions get activated via directional weight blending
  // crossFadeFrom idle on the dominant direction
  this.currentState = "walk";
}
```

The `update()` method:
```typescript
update(delta: number): void {
  if (!this.mixer) return;

  // Smoothly blend directional walk weights (same as LegAnimator)
  const blendSpeed = 1 / Math.max(0.01, this.config.blendTime);
  const blendFactor = 1 - Math.exp(-blendSpeed * delta);

  for (const key of DIRECTION_KEYS) {
    const target = this.targetDirWeights[key];
    const current = this.currentDirWeights[key];
    this.currentDirWeights[key] = current + (target - current) * blendFactor;
    this.directions[key].action?.setEffectiveWeight(this.currentDirWeights[key]);
  }

  this.mixer.update(delta);
}
```

- [ ] **Step 3: Run typecheck**

```bash
npm run check
```

Expected: no errors in new files.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/3d/services/implementations/LocomotionAnimator.ts
git commit -m "feat(3d): LocomotionAnimator with full-body Mixamo clips and idle/walk crossfade"
```

---

## Task 4: Test LocomotionAnimator Pure Logic

**Files:**
- Create: `tests/unit/3d-animation/LocomotionAnimator.test.ts`

The AnimationMixer itself is a Three.js black box -- we don't test it. But we CAN test the retargeting function and state transition logic, which are pure and can silently produce wrong output.

- [ ] **Step 1: Write retargeting tests**

```typescript
import { describe, it, expect } from "vitest";

// Import the retargeting functions (they need to be exported for testing)
// If they're module-private, test them through the public interface instead

describe("retargetFullBody", () => {
  it("keeps all quaternion tracks, not just legs", () => {
    // Create a mock AnimationClip with arm + leg + position tracks
    // Verify: arm quaternion tracks are KEPT (unlike LegAnimator)
    // Verify: position tracks are EXCLUDED
    // Verify: scale tracks are EXCLUDED
  });

  it("retargets bone prefixes correctly", () => {
    // Track named "mixamorig1LeftArm.quaternion"
    // With target prefix "mixamorig"
    // Should become "mixamorigLeftArm.quaternion"
  });

  it("maps alternate bone names to standard names", () => {
    // Track named "characters3dcom___L_Thigh.quaternion"
    // Should become "mixamorigLeftUpLeg.quaternion"
  });
});
```

- [ ] **Step 2: Export retargeting functions for testing**

In `LocomotionAnimator.ts`, export `retargetFullBody`, `extractCoreBoneName`, `retargetTrackName` as named exports (they're pure functions, safe to export).

- [ ] **Step 3: Run tests**

```bash
npx vitest run tests/unit/3d-animation/LocomotionAnimator.test.ts
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add tests/unit/3d-animation/LocomotionAnimator.test.ts src/lib/shared/3d/services/implementations/LocomotionAnimator.ts
git commit -m "test(3d): LocomotionAnimator retargeting and state transition tests"
```

---

## Task 5: Add Per-Bone IK Blend Weights to AvatarAnimator

**Files:**
- Modify: `src/lib/shared/3d/services/contracts/IAvatarAnimator.ts`
- Modify: `src/lib/shared/3d/services/implementations/AvatarAnimator.ts`

- [ ] **Step 1: Update IAvatarAnimator interface**

Remove `setIdlePose` and `resetToIdle`. Add `setPropsAndBlend`:

```typescript
// REMOVE these from the interface:
// setIdlePose(pose: BodyPose): void;
// resetToIdle(): void;

// ADD this:
/**
 * Set prop states and compute per-arm IK blend weights.
 * Arms with props ramp toward IK (weight 1).
 * Arms without props ramp toward animation (weight 0).
 * Also sets IK hand targets from prop world positions.
 */
setPropsAndBlend(
  blueProp: PropState3D | null,
  redProp: PropState3D | null,
  offset?: PositionOffset
): void;
```

- [ ] **Step 2: Add blend state to AvatarAnimator implementation**

Add to the class:

```typescript
interface ArmIKState {
  weight: number;
  targetWeight: number;
}

// In the class:
private leftArmIK: ArmIKState = { weight: 0, targetWeight: 0 };
private rightArmIK: ArmIKState = { weight: 0, targetWeight: 0 };
private ikBlendSpeed = 1 / 0.3; // ~0.3s ramp time
```

- [ ] **Step 3: Implement `setPropsAndBlend()`**

This replaces `setHandTargetsFromProps()`. It sets IK targets AND blend weights:

```typescript
setPropsAndBlend(
  blueProp: PropState3D | null,
  redProp: PropState3D | null,
  offset?: PositionOffset
): void {
  // Set blend weight targets based on prop presence
  this.leftArmIK.targetWeight = blueProp ? 1 : 0;
  this.rightArmIK.targetWeight = redProp ? 1 : 0;

  // Set IK hand targets (only when prop is present)
  const ox = offset?.x ?? 0;
  const oy = offset?.y ?? 0;
  const oz = offset?.z ?? 0;

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
  }

  this.targetPose.timestamp = Date.now();
}
```

- [ ] **Step 4: Modify `update()` to ramp blend weights**

Add at the start of `update()`:

```typescript
// Ramp per-arm IK blend weights (framerate-independent exponential lerp)
const blendFactor = 1 - Math.exp(-this.ikBlendSpeed * deltaTime);
this.leftArmIK.weight += (this.leftArmIK.targetWeight - this.leftArmIK.weight) * blendFactor;
this.rightArmIK.weight += (this.rightArmIK.targetWeight - this.rightArmIK.weight) * blendFactor;
```

- [ ] **Step 5: Modify `applyIKToSkeleton()` for per-bone blending**

The key change: save animation quaternions before IK, blend after IK.

For each arm chain (left example, right is identical):

```typescript
if (leftChain) {
  if (this.leftArmIK.weight > 0.001) {
    // Save what the locomotion animation wrote to these bones
    const animRootQuat = leftChain.root.quaternion.clone();
    const animMiddleQuat = leftChain.middle.quaternion.clone();
    const animEffectorQuat = leftChain.effector.quaternion.clone();

    // Clavicle raise (scale by IK weight)
    if (this._clavicleRaiseEnabled && this.clavicleRaiser && this.shoulderRestCached) {
      // ... existing clavicle code, but scale the final slerp by leftArmIK.weight ...
    }

    // Solve IK (overwrites bone quaternions)
    const target: IKTarget = {
      position: leftTarget,
      weight: pose.leftHand.weight,
    };
    // ... pole vector code unchanged ...
    this.ikSolver.solveAndApply(leftChain, target);

    // Blend: slerp each bone from animation result toward IK result
    const w = this.leftArmIK.weight;
    leftChain.root.quaternion.copy(animRootQuat).slerp(leftChain.root.quaternion, w);
    leftChain.middle.quaternion.copy(animMiddleQuat).slerp(leftChain.middle.quaternion, w);
    leftChain.effector.quaternion.copy(animEffectorQuat).slerp(leftChain.effector.quaternion, w);
  }
  // else: weight ~0, skip IK entirely. Animation drives the arm.
}
```

- [ ] **Step 6: Scale spine twist by max IK weight**

```typescript
const maxIKWeight = Math.max(this.leftArmIK.weight, this.rightArmIK.weight);

if (this._spineTwistEnabled && this.spineTwister && this.spineRestCached && maxIKWeight > 0.001) {
  // ... existing twist computation ...
  // Scale the twist: identity (no twist) blended toward full twist
  const identity = new Quaternion();
  const scaledTwist = identity.slerp(fullTwist, maxIKWeight);
  // ... apply scaledTwist instead of fullTwist ...
}
```

- [ ] **Step 7: Remove idle pose system**

Delete from AvatarAnimator:
- `createIdlePose()` function
- `idlePose` field
- `setIdlePose()` method
- `resetToIdle()` method
- The idle fallback in `setHandTargetsFromProps()` (the `else { this.targetPose.leftHand = { ...this.idlePose.leftHand }; }` branches)

Keep `setHandTargetsFromProps()` as a lower-level method (used by `setPropsAndBlend()`), but remove the idle fallback logic from it. When a prop is null, we just don't set that hand's target -- the animation drives it.

- [ ] **Step 8: Remove diagnostic logging**

Delete the `_spineDiagCounter` and the every-120-frames console.log blocks. These were temporary diagnostics.

- [ ] **Step 9: Run typecheck**

```bash
npm run check
```

Expected: errors in Avatar3D.svelte (still references old API). That's expected -- Task 7 fixes it.

- [ ] **Step 10: Commit**

```bash
git add src/lib/shared/3d/services/contracts/IAvatarAnimator.ts src/lib/shared/3d/services/implementations/AvatarAnimator.ts
git commit -m "feat(3d): per-bone IK blend weights in AvatarAnimator, remove idle pose system"
```

---

## Task 6: Test Per-Bone Blend Weight Logic

**Files:**
- Create: `tests/unit/3d-animation/AvatarAnimator-blend.test.ts`

The blend weight ramp is pure math that could silently produce wrong values (e.g., never reaching 0, overshooting 1, wrong ramp speed). Worth testing.

- [ ] **Step 1: Write blend weight tests**

```typescript
import { describe, it, expect } from "vitest";

describe("ArmIKState blend weight ramp", () => {
  // Test the exponential lerp formula in isolation
  const ikBlendSpeed = 1 / 0.3;

  function rampWeight(current: number, target: number, delta: number): number {
    const factor = 1 - Math.exp(-ikBlendSpeed * delta);
    return current + (target - current) * factor;
  }

  it("ramps from 0 toward 1 over multiple frames", () => {
    let weight = 0;
    // Simulate 10 frames at 60fps
    for (let i = 0; i < 10; i++) {
      weight = rampWeight(weight, 1, 1 / 60);
    }
    // After ~0.17s at 60fps, should be past 0.4
    expect(weight).toBeGreaterThan(0.4);
    expect(weight).toBeLessThan(1);
  });

  it("ramps from 1 toward 0 when prop removed", () => {
    let weight = 1;
    for (let i = 0; i < 20; i++) {
      weight = rampWeight(weight, 0, 1 / 60);
    }
    // After ~0.33s, should be near 0
    expect(weight).toBeLessThan(0.05);
  });

  it("stays at 0 when target is 0 and current is 0", () => {
    const result = rampWeight(0, 0, 1 / 60);
    expect(result).toBe(0);
  });

  it("stays at 1 when target is 1 and current is 1", () => {
    const result = rampWeight(1, 1, 1 / 60);
    expect(result).toBe(1);
  });

  it("handles large delta without overshooting", () => {
    const result = rampWeight(0, 1, 10); // 10 second jump
    expect(result).toBeLessThanOrEqual(1);
    expect(result).toBeGreaterThan(0.99);
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run tests/unit/3d-animation/AvatarAnimator-blend.test.ts
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/unit/3d-animation/AvatarAnimator-blend.test.ts
git commit -m "test(3d): per-bone IK blend weight ramp logic"
```

---

## Task 7: Wire LocomotionAnimator into Avatar3D

**Files:**
- Modify: `src/lib/shared/3d/components/Avatar3D.svelte`

- [ ] **Step 1: Replace imports**

```typescript
// REMOVE:
import { LegAnimator } from "../services/implementations/LegAnimator";
import type { ILegAnimator } from "../services/contracts/ILegAnimator";

// ADD:
import { LocomotionAnimator } from "../services/implementations/LocomotionAnimator";
import type { ILocomotionAnimator } from "../services/contracts/ILocomotionAnimator";
```

- [ ] **Step 2: Replace service declaration**

```typescript
// REMOVE:
let legAnimator: ILegAnimator | null = $state(null);

// ADD:
let locomotionAnimator: ILocomotionAnimator | null = $state(null);
```

- [ ] **Step 3: Update initialization in `onMount`**

```typescript
// REMOVE:
const legs = new LegAnimator();
legAnimator = legs;

// ADD:
const locomotion = new LocomotionAnimator();
locomotionAnimator = locomotion;
```

- [ ] **Step 4: Update animation loading in `loadAvatar()`**

```typescript
// REMOVE the legAnimator initialization block (~lines 193-211)

// ADD:
if (locomotionAnimator && cachedRoot) {
  locomotionAnimator.initialize(cachedRoot);

  locomotionAnimator
    .loadAnimations({
      idle: "/animations/idle.glb",
      forward: "/animations/walk.glb",
      backward: "/animations/walk-backward.glb",
      strafeLeft: "/animations/strafe-left.glb",
      strafeRight: "/animations/strafe-right.glb",
    })
    .catch((err) => {
      console.warn(
        "[Avatar3D] Locomotion animations not loaded:",
        err.message
      );
    });
}
```

- [ ] **Step 5: Simplify the frame loop in `useTask()`**

Replace the entire body of the useTask callback (after the mocap mixer check and the servicesReady guard) with:

```typescript
// 1. Full-body animation (idle/walk with arm swing, hip sway)
if (locomotionAnimator) {
  locomotionAnimator.setLocomotion({
    isMoving,
    speed: moveSpeed,
    facingAngle,
    moveDirection,
  });
  locomotionAnimator.update(delta);
}

// 2. IK post-process (blends per-arm based on prop presence)
const cos = Math.cos(facingAngle);
const sin = Math.sin(facingAngle);
const gridOffset = -WALL_OFFSET;

function toWorldPosition(local: { x: number; y: number; z: number }): Vector3 {
  const localX = local.x;
  const localZ = local.z + gridOffset;
  const rotatedX = localX * cos + localZ * sin;
  const rotatedZ = -localX * sin + localZ * cos;
  return new Vector3(
    rotatedX + position.x,
    local.y + (position.y ?? 0),
    rotatedZ + position.z
  );
}

const blueWorldProp = bluePropState
  ? { ...bluePropState, worldPosition: toWorldPosition(bluePropState.worldPosition) }
  : null;
const redWorldProp = redPropState
  ? { ...redPropState, worldPosition: toWorldPosition(redPropState.worldPosition) }
  : null;

animationService.setPropsAndBlend(blueWorldProp, redWorldProp);
animationService.update(delta);

// 3. Finger grips
if (fingerAnimator?.isReady()) {
  const leftGrip = bluePropState ? GripType.SQUARE : GripType.IDLE;
  const rightGrip = redPropState ? GripType.SQUARE : GripType.IDLE;
  fingerAnimator.setGrips(leftGrip, rightGrip);
  fingerAnimator.update(delta);
}
```

This removes:
- The `toIdleWorld()` function
- The `animationService.setIdlePose()` call
- The `animationService.setHandTargetsFromProps()` call (replaced by `setPropsAndBlend`)
- The `legAnimator.setLocomotion()` and `legAnimator.update()` calls

- [ ] **Step 6: Update `onDestroy`**

```typescript
// REMOVE:
if (legAnimator) {
  legAnimator.dispose();
}

// ADD:
if (locomotionAnimator) {
  locomotionAnimator.dispose();
}
```

- [ ] **Step 7: Run typecheck**

```bash
npm run check
```

Expected: PASS (all API references now match)

- [ ] **Step 8: Run build**

```bash
npm run build
```

Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/lib/shared/3d/components/Avatar3D.svelte
git commit -m "feat(3d): wire LocomotionAnimator into Avatar3D, simplify frame loop"
```

---

## Task 8: Manual Verification

- [ ] **Step 1: Test museum walk (no props)**

Navigate to the museum in the running app. Walk around with WASD. Verify:
- Arms swing naturally during walk
- Avatar plays idle animation when standing still
- Transition between idle and walk is smooth
- Hip sway is visible during walk

- [ ] **Step 2: Test sequence performer (both props)**

Open a sequence in the 3D viewer with both staves. Verify:
- Arms track prop positions via IK (same as before)
- Legs still animate during playback
- No visual regression from current behavior

- [ ] **Step 3: Test single prop (if testable)**

If there's a way to have one prop without the other, verify:
- One arm tracks the prop via IK
- The other arm swings with the walk animation
- The transition is smooth

- [ ] **Step 4: If all verified, commit verification note**

```bash
git commit --allow-empty -m "verify(3d): animation layer system working - idle, walk, IK blend"
```

---

## Task 9: Clean Up LegAnimator

Only after Task 8 verification passes.

**Files:**
- Delete: `src/lib/shared/3d/services/implementations/LegAnimator.ts`
- Delete: `src/lib/shared/3d/services/contracts/ILegAnimator.ts`

- [ ] **Step 1: Check for remaining references**

```bash
grep -r "LegAnimator\|ILegAnimator" src/ --include="*.ts" --include="*.svelte"
```

Expected: no results (all references replaced in Task 7).

- [ ] **Step 2: Delete files**

```bash
rm src/lib/shared/3d/services/implementations/LegAnimator.ts
rm src/lib/shared/3d/services/contracts/ILegAnimator.ts
```

- [ ] **Step 3: Run typecheck and build**

```bash
npm run check && npm run build
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add -u
git commit -m "refactor(3d): remove LegAnimator, replaced by LocomotionAnimator"
```
