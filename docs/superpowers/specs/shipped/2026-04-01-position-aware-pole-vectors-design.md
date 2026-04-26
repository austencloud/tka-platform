# Position-Aware Pole Vectors for Avatar IK

**Date:** 2026-04-01
**Status:** Approved
**Scope:** Layer 1 of avatar self-collision prevention

## Problem

The avatar's IK solver uses a hardcoded pole hint of `(0, 0, -1)` for all arm solves (`IKSolver.ts:35`). This means elbows always bend backward regardless of hand position or operating plane. When hands reach across the body or move to positions near the torso, arms clip straight through the body.

## Solution

Introduce a new service (`ElbowPoleComputer`) that computes per-arm pole vectors dynamically based on:
1. Which plane the prop is operating on (wall, wheel, floor)
2. Where the hand target is relative to the avatar's body center
3. Which arm (left vs right) — determines lateral bias direction

The pole vector tells the IK solver which direction the elbow should bend. By making this context-aware, elbows naturally swing away from the torso.

## Architecture

### New Service

```
src/lib/shared/3d/
  services/
    contracts/IElbowPoleComputer.ts
    implementations/ElbowPoleComputer.ts
```

**Interface:**

```typescript
export interface IElbowPoleComputer {
  computePoleVector(
    handTarget: Vector3,
    plane: Plane,
    side: "left" | "right",
    bodyCenter: Vector3
  ): Vector3;
}
```

Single method. Pure function. No state. Takes everything it needs as arguments.

### Pole Vector Logic

Each plane defines a base pole direction (the default "escape route" for the elbow). Position-aware adjustments shift the pole based on where the hand is relative to the body.

#### Wall Plane (XY — current system)

- **Base pole:** `(0, 0, 1)` — forward, toward camera/audience
- **Cross-body adjustment:** When the hand crosses the body centerline (left hand in +X territory or right hand in -X territory), increase forward Z component. This is the most common clipping scenario — arms reaching to the opposite side.
- **Low position adjustment:** When hand is below shoulder height, add slight outward X bias (left arm gets -X, right arm gets +X) to keep elbows from pinching inward.
- **Overhead adjustment:** When hand is above head height, pole shifts slightly downward to keep elbow in a natural raised position.

#### Wheel Plane (YZ — side view / cartwheel)

- **Base pole:** `(-1, 0, 0)` for left arm, `(1, 0, 0)` for right arm — outward laterally
- **Forward/back adjustment:** When hand is in front of or behind the body, add Y bias to keep elbow from colliding with the torso side.

#### Floor Plane (XZ — horizontal)

- **Base pole:** `(0, 1, 0)` — upward
- **Center proximity adjustment:** When hand is near body center on the horizontal plane, add outward X bias to prevent elbow from dropping into the torso.

#### Cross-Plane (mixed)

Each arm computes independently. Left hand on wall plane, right hand on wheel plane — each gets its own pole vector from its own plane logic. No special handling needed because the computation is per-arm.

### Computation Details

The position-aware adjustment uses a blend factor based on how far the hand has crossed into "danger zones":

```
SHOULDER_HALF_WIDTH = 0.2  // ~20cm, half the shoulder span
crossBodyFactor = clamp((handLocalX * sideSign) / SHOULDER_HALF_WIDTH, 0, 1)
```

Where `sideSign` is -1 for left, +1 for right. The normalization by `SHOULDER_HALF_WIDTH` maps the cross-body distance to a 0-1 range proportional to the body's actual width. When `crossBodyFactor` is high, the hand is on the wrong side of the body and the forward Z component increases proportionally.

The final pole vector is the normalized sum of:
1. Base pole for the plane
2. Cross-body adjustment (scaled by crossBodyFactor)
3. Height adjustment (scaled by vertical offset from shoulder)

All vectors are normalized before being passed to the IK solver.

### Smoothing

The `ElbowPoleComputer` itself is stateless — it returns the ideal pole vector for the current frame. Smoothing happens in the `AvatarAnimator` by lerping between the previous frame's pole vector and the new one, using the same `smoothingFactor` already used for hand position blending. This prevents elbow popping during transitions.

## Integration Changes

### AvatarAnimator (modifications)

1. **Store plane per hand:** `setHandTargetsFromProps()` already receives `PropState3D` which has `.plane`. Store it alongside the target position in `HandPose`.
2. **Store previous pole vectors:** Two `Vector3` fields for lerp-based smoothing.
3. **Compute poles in `applyIKToSkeleton()`:** Before calling `ikSolver.solveAndApply()`, compute the pole vector via `ElbowPoleComputer`, smooth it, and pass it through.

### IKSolver (modifications)

1. **`solve()` and `solveAndApply()` read `poleHint` from `IKTarget`:** Instead of hardcoding `new Vector3(0, 0, -1)`, these methods check `target.poleHint`. If present, pass it to `solveTwoBone()`. If absent, fall back to `(0, 0, -1)`.
2. **`solveTwoBone()` signature unchanged:** It already accepts `poleHint: Vector3` as a parameter. No changes needed there.

### IAvatarAnimator interface (modifications)

1. **`HandPose` gets optional `plane` field:** So the animator knows which plane each hand is on.

### IIKSolver interface (modifications)

1. **`IKTarget` gets optional `poleHint` field:** So the solver can receive per-solve pole vectors. The `solveTwoBone` public signature is unaffected — it already takes a pole hint parameter.

### AvatarAnimator: obtaining bodyCenter

The `bodyCenter` passed to `ElbowPoleComputer` is the avatar's root/hips world position. `AvatarAnimator` already holds a reference to `IAvatarSkeletonBuilder`, which provides bone access. Each frame, get the `Hips` bone world position (or fall back to `(0, 0, 0)` if unavailable). This value is cached per frame, not per arm.

## Backward Compatibility

All changes are additive. Existing code that constructs `IKTarget` as `{ position, weight }` continues to work — the missing `poleHint` triggers the `(0, 0, -1)` fallback. Similarly, `HandPose` objects without `plane` behave exactly as before. No existing call sites require changes.

## Files Changed

| File | Change |
|------|--------|
| `services/contracts/IElbowPoleComputer.ts` | New — interface |
| `services/implementations/ElbowPoleComputer.ts` | New — implementation |
| `services/contracts/IAvatarAnimator.ts` | Add `plane?: Plane` to `HandPose` |
| `services/contracts/IIKSolver.ts` | Add `poleHint?: Vector3` to `IKTarget` |
| `services/implementations/AvatarAnimator.ts` | Store planes, compute poles, smooth, pass to IK |
| `services/implementations/IKSolver.ts` | Use `target.poleHint` in `solve()` and `solveAndApply()` instead of hardcoded vector |
| DI container (avatar/3d container) | Register `ElbowPoleComputer`, inject into `AvatarAnimator` |

## Testing

The `ElbowPoleComputer` is pure math — ideal for unit tests. Test cases:

1. **Wall plane, hand at center-right (normal position):** Pole should be primarily forward (+Z)
2. **Wall plane, left hand crossing to right side:** Pole should have strong forward Z, pushing elbow out front
3. **Wall plane, hand at south:** Pole should have forward Z + slight outward X
4. **Wheel plane, hand forward:** Pole should be lateral (±X) with Y adjustment
5. **Floor plane, hand near center:** Pole should be upward (+Y) with outward X bias
6. **Mixed planes:** Each arm independently correct
7. **Degenerate pole — floor plane, hand directly above body:** Pole `(0, 1, 0)` is parallel to target direction `(0, 1, 0)`. Verify the IK solver's built-in fallback (`IKSolver.ts:121-128`) produces a stable result without visual popping.
8. **Degenerate pole — wheel plane, hand directly to the side:** Same parallel case with `(±1, 0, 0)`. Verify fallback stability.
9. **All returned vectors are unit length:** Non-normalized poles would subtly distort IK solutions — exactly the kind of silent bug that warrants a test.

Note: The IK solver already has a safety net for degenerate poles (cross product near zero → fallback axis). The `ElbowPoleComputer` does not need to handle this case, but the tests verify end-to-end stability.

## Future: Approach C — Collision Sphere Enhancement

This design explicitly prepares for the next layer of self-collision prevention. Approach C is a **separate service** (`ICollisionResolver` or similar), not a decorator of `IElbowPoleComputer`, because it needs access to the IK solver and bone chains — responsibilities outside the pole computer's contract.

The collision resolver would:

1. Run after the IK solve pass in `AvatarAnimator.applyIKToSkeleton()`
2. Raycast the forearm segment against torso collision capsules/spheres
3. If intersection detected, offset the hand target along the plane normal and re-solve IK
4. The `ElbowPoleComputer` from this spec feeds into the initial IK solve; the collision resolver handles the post-solve correction

This means `AvatarAnimator.applyIKToSkeleton()` gains one additional step (collision check + re-solve), but `ElbowPoleComputer` and `IKSolver` remain unchanged.

### Beyond Approach C: Body Locomotion Response

The long-term vision includes the avatar stepping backward, twisting the spine, and using negative space (elbow forward, prop behind body). This requires:

- Motion capture data from real performers to establish ground-truth body responses per grid position
- A locomotion decision layer that reads upcoming sequence data and pre-positions the body
- Spine twist IK (additional bone chain beyond the current 2-bone arm chains)

These are separate future specs. The current pole vector work is a prerequisite — the avatar needs to know where its elbows should be before it can know when to step out of the way.
