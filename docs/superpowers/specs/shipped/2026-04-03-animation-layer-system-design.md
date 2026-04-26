# Animation Layer System: Full-Body Mixamo + IK Post-Process

**Date:** 2026-04-03
**Status:** Draft
**Scope:** Replace leg-only animation with full-body Mixamo clips + per-bone IK blending

---

## Problem

The avatar's arms are locked at crotch height when no props are held. The current system splits animation into two independent subsystems:

- **LegAnimator**: Plays walk clips filtered to leg bones only via `filterAndRetargetToLegBones()`
- **AvatarAnimator**: IK solver that targets hardcoded hand positions (y=0.5m) when no props are present

This means the walk animation's natural arm swing is stripped out, and the IK fallback places hands at an unnatural position. The fix isn't adjusting the Y value -- it's adopting the standard game engine pattern: full-body baked animations as a base layer, with IK applied as a weighted post-process.

## Architecture: Animation Base + IK Post-Process

### Frame Update Pipeline

```
1. LocomotionAnimator.update(delta)   -- full-body Mixamo clips via AnimationMixer
2. AvatarAnimator.update(delta)       -- IK post-process, per-bone weighted
3. FingerAnimator.update(delta)       -- unchanged
```

The mixer writes all bone rotations (arms, spine, hips, legs). Then IK conditionally overwrites arm bones based on a per-bone blend weight. At weight 0, the animation's rotation is untouched. At weight 1, IK fully overwrites it.

**Matrix update ordering:** LocomotionAnimator calls `mixer.update(delta)` which writes bone quaternions. AvatarAnimator then reads those quaternions, solves IK, and blends. After AvatarAnimator finishes, `skeleton.updateMatrices()` is called (already happens at end of `applyIKToSkeleton()`). FingerAnimator runs after this, so it reads correct world-space transforms. Three.js auto-updates world matrices before render, but our pipeline doesn't rely on that -- each stage explicitly updates what the next stage needs.

```typescript
// Per-arm blend: animation vs IK
const mixerQuat = bone.quaternion.clone();
const ikQuat = ikSolver.solve(chain, target);
bone.quaternion.copy(mixerQuat).slerp(ikQuat, armIKWeight);
```

### Resulting Behaviors

| Scenario | Left Arm | Right Arm | Legs/Spine |
|----------|----------|-----------|------------|
| No props (museum walk) | Animation swing | Animation swing | Animation |
| Both props (sequence performer) | IK tracking | IK tracking | Animation |
| Left prop only | IK tracking | Animation swing | Animation |
| Right prop only | Animation swing | IK tracking | Animation |
| Transition (pick up prop) | Smooth blend 0->1 | Unchanged | Animation |

---

## Component 1: LocomotionAnimator

Replaces `LegAnimator`. Plays full-body Mixamo clips without bone filtering.

### Interface

```typescript
interface ILocomotionAnimator {
  initialize(root: Object3D): void;
  loadAnimations(urls: AnimationUrls): Promise<void>;
  setLocomotion(input: LocomotionInput): void;
  update(delta: number): void;
  isReady(): boolean;
  configure(config: LocomotionConfig): void;
  dispose(): void;
}

interface AnimationUrls {
  idle: string;
  forward: string;
  backward: string;
  strafeLeft: string;
  strafeRight: string;
}
```

### Key Differences from LegAnimator

1. **No `filterAndRetargetToLegBones()`** -- clips play on all bones. Retargeting (prefix mapping) stays, filtering removed.
2. **Idle clip** -- new required animation. Crossfades with walk clips via `crossFadeFrom()`.
3. **`crossFadeFrom()` for idle/walk transitions** -- replaces manual weight lerping for the moving/stopped transition. Directional blending between walk variants still uses simultaneous weight lerping (correct tool for multi-clip blending).
4. **Hips rotation included** -- LegAnimator excluded Hips because it caused the avatar to "lie down" when only leg bones were animated. With full-body "In Place" clips, Hips rotation tracks play through for natural hip sway. Hips *position* tracks are still excluded (no root motion -- locomotion system controls position).

### Retargeting (Kept from LegAnimator)

The bone prefix detection and name mapping stays identical:
- `detectBonePrefix()` finds the avatar's naming convention
- `retargetTrackName()` remaps animation track names to match
- `BONE_PREFIXES` and `BONE_NAME_MAPPING` tables unchanged

### New: `retargetFullBody()` Function

Replaces `filterAndRetargetToLegBones()`. Same retargeting logic, but:
- Includes ALL .quaternion tracks for ALL bones (not just leg bones)
- Excludes ALL .position tracks on ALL bones (prevents root motion displacement -- this applies to every bone, not just Hips, because position keyframes from Mixamo can cause unexpected bone offsets)
- Excludes ALL .scale tracks (prevents disappearing meshes)

```typescript
function retargetFullBody(
  clip: AnimationClip,
  targetPrefix: string
): AnimationClip {
  const tracks: KeyframeTrack[] = [];

  for (const track of clip.tracks) {
    if (!track.name.includes(".quaternion")) continue;

    const boneName = track.name.split(".")[0] ?? "";
    const newTrackName = retargetTrackName(track.name, targetPrefix);
    const clonedTrack = track.clone();
    clonedTrack.name = newTrackName;
    tracks.push(clonedTrack);
  }

  return new AnimationClip(clip.name + "_fullbody", clip.duration, tracks);
}
```

### Idle/Walk Crossfade

```typescript
private switchToIdle(): void {
  if (this.currentState === "idle") return;
  this.idleAction.reset().play();
  // Third arg `true` enables time warping -- smoothly syncs clips with different durations
  this.idleAction.crossFadeFrom(this.activeWalkAction, 0.3, true);
  this.currentState = "idle";
}

private switchToWalk(): void {
  if (this.currentState === "walk") return;
  // Activate directional walk actions, crossfade from idle
  this.activateDirectionalBlend();
  this.currentState = "walk";
}
```

Directional blending between walk variants (forward/backward/strafe) uses the same simultaneous weight approach as LegAnimator -- that pattern is correct for blending multiple concurrent clips.

### Error Handling: Animation Load Failures

`loadAnimations()` loads 5 clips in parallel. Any clip can fail (network, missing file). Strategy:

- **Idle fails:** Log warning. Avatar stays in T-pose when stationary (visually wrong but not a crash). This is the most likely failure during development since it's the new asset.
- **Any walk clip fails:** Log warning. That direction falls back to zero weight. Other directions still work. Walking forward with only forward.glb missing means the avatar idles while moving (weird but functional).
- **All clips fail:** Log error. `isReady()` returns false. Avatar3D falls through to procedural fallback (same as current GLTF load failure path).

The animator is usable in a degraded state. No throws -- animation is optional, same philosophy as current LegAnimator.

---

## Component 2: AvatarAnimator -- Per-Bone IK Blending

### New State

```typescript
interface ArmIKState {
  weight: number;        // Current blend (0 = animation, 1 = IK)
  targetWeight: number;  // Ramp target
}

private leftArmIK: ArmIKState = { weight: 0, targetWeight: 0 };
private rightArmIK: ArmIKState = { weight: 0, targetWeight: 0 };
```

### Weight Logic

```typescript
// Called when prop states change
setPropsAndBlend(blueProp: PropState3D | null, redProp: PropState3D | null): void {
  this.leftArmIK.targetWeight = blueProp ? 1 : 0;
  this.rightArmIK.targetWeight = redProp ? 1 : 0;

  if (blueProp) {
    this.targetPose.leftHand = /* world position from prop */;
  }
  if (redProp) {
    this.targetPose.rightHand = /* world position from prop */;
  }
}
```

Each frame, weights ramp via exponential lerp (~0.3s transition):

```typescript
const blendSpeed = 1 / 0.3;
const blendFactor = 1 - Math.exp(-blendSpeed * delta);
this.leftArmIK.weight += (this.leftArmIK.targetWeight - this.leftArmIK.weight) * blendFactor;
this.rightArmIK.weight += (this.rightArmIK.targetWeight - this.rightArmIK.weight) * blendFactor;
```

### Modified `applyIKToSkeleton()`

```typescript
private applyIKToSkeleton(pose: BodyPose): void {
  // ... existing body center, spine twist, etc ...

  if (leftChain && this.leftArmIK.weight > 0.001) {
    // Save what the animation wrote
    const savedQuats = this.saveChainQuaternions(leftChain);

    // Solve IK (overwrites bone quats)
    this.ikSolver.solveAndApply(leftChain, leftTarget);

    // Blend: slerp each bone between animation result and IK result
    this.blendChainQuaternions(leftChain, savedQuats, this.leftArmIK.weight);
  }
  // weight <= 0.001: skip IK entirely, animation drives the arm

  // Same for right arm...
}

// BoneChain has root, middle, effector — not a bones array.
// Save/blend each bone individually:

// Before IK solve:
const animRootQuat = chain.root.quaternion.clone();
const animMiddleQuat = chain.middle.quaternion.clone();
const animEffectorQuat = chain.effector.quaternion.clone();

// After IK solve, blend:
chain.root.quaternion.copy(animRootQuat).slerp(chain.root.quaternion, ikWeight);
chain.middle.quaternion.copy(animMiddleQuat).slerp(chain.middle.quaternion, ikWeight);
chain.effector.quaternion.copy(animEffectorQuat).slerp(chain.effector.quaternion, ikWeight);
```

### Spine Twist and Clavicle Scaling

Spine twist and clavicle raise scale by the max IK weight of both arms:

```typescript
const maxIKWeight = Math.max(this.leftArmIK.weight, this.rightArmIK.weight);

// Spine twist only engages when at least one arm is in IK
if (this._spineTwistEnabled && this.spineTwister && maxIKWeight > 0.001) {
  // Scale twist by IK weight: identity quaternion (no twist) blended toward full twist
  const identity = new Quaternion(); // (0, 0, 0, 1) -- no rotation
  const scaledTwist = identity.slerp(fullTwist, maxIKWeight);
  // apply...
}
```

When both arms are in animation mode (no props), spine twist and clavicle raise are fully inactive. The Mixamo animation handles the natural body movement.

### What Gets Removed

- `idlePose` / `createIdlePose()` / `setIdlePose()` -- no more hardcoded hand positions
- The `resetToIdle()` method -- animation handles idle state
- The `toIdleWorld()` calculation block in Avatar3D's frame loop

---

## Component 3: Avatar3D Orchestration

### Simplified Frame Loop

```typescript
useTask((delta) => {
  if (!servicesReady || !animationService || useProceduralFallback) return;

  // 1. Full-body animation (idle/walk with arm swing, hip sway, etc)
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
  const blueWorldProp = bluePropState ? toWorldProp(bluePropState) : null;
  const redWorldProp = redPropState ? toWorldProp(redPropState) : null;
  animationService.setPropsAndBlend(blueWorldProp, redWorldProp);
  animationService.update(delta);

  // 3. Finger grips
  if (fingerAnimator?.isReady()) {
    const leftGrip = bluePropState ? GripType.SQUARE : GripType.IDLE;
    const rightGrip = redPropState ? GripType.SQUARE : GripType.IDLE;
    fingerAnimator.setGrips(leftGrip, rightGrip);
    fingerAnimator.update(delta);
  }
});
```

### What's Removed from Avatar3D

- `toIdleWorld()` function and the `setIdlePose()` call block (~20 lines)
- Import of `ILegAnimator` (replaced by `ILocomotionAnimator`)

### Initialization Change

```typescript
// Old
const legs = new LegAnimator();
legAnimator = legs;

// New
const locomotion = new LocomotionAnimator();
locomotionAnimator = locomotion;
```

Animation loading adds the idle clip:

```typescript
locomotionAnimator.loadAnimations({
  idle: "/animations/idle.glb",
  forward: "/animations/walk.glb",
  backward: "/animations/walk-backward.glb",
  strafeLeft: "/animations/strafe-left.glb",
  strafeRight: "/animations/strafe-right.glb",
});
```

---

## New Asset Required

**`static/animations/idle.glb`** -- Mixamo idle animation.

Source: mixamo.com, search "Idle" or "Breathing Idle". Download as FBX, convert to GLB in Blender. Check "In Place" (though idle doesn't move anyway). Should be ~80-90KB like the walk files.

The four existing walk GLBs (`walk.glb`, `walk-backward.glb`, `strafe-left.glb`, `strafe-right.glb`) are reused as-is. They already contain full-body animation data -- LegAnimator was just discarding the upper body tracks.

---

## Migration Path

1. Create `ILocomotionAnimator` interface and `LocomotionAnimator` class
2. Add per-bone IK blending to `AvatarAnimator`
3. Download and add `idle.glb` asset
4. Update `Avatar3D.svelte` to use new pipeline
5. Verify: museum walk (no props), sequence performer (both props), single prop
6. Delete `LegAnimator` and `ILegAnimator` after verification

`LegAnimator` is not deleted until the new system is verified working. Both can coexist during development.

---

## File Changes

| File | Change |
|------|--------|
| `services/contracts/ILocomotionAnimator.ts` | New interface |
| `services/implementations/LocomotionAnimator.ts` | New class (LegAnimator without bone filter + idle clip + crossfade) |
| `services/implementations/AvatarAnimator.ts` | Add per-bone blend weights, remove idle pose system |
| `services/contracts/IAvatarAnimator.ts` | Remove `setIdlePose`/`resetToIdle`, add `setPropsAndBlend` |
| `components/Avatar3D.svelte` | Swap LegAnimator -> LocomotionAnimator, simplify frame loop |
| `static/animations/idle.glb` | New Mixamo asset |

**Note:** LocomotionAnimator is manually instantiated in Avatar3D (same as current LegAnimator) -- not registered in a DI container. Each Avatar3D creates its own instance to ensure the mixer is bound to that avatar's skeleton. No container changes needed.

### Unchanged Files

AvatarSkeletonBuilder, IKSolver, ElbowPoleComputer, ClavicleRaiser, SpineTwister, FingerAnimator -- all unchanged.
