# Clavicle Raise for Avatar IK

**Date:** 2026-04-01
**Status:** Approved
**Scope:** Secondary motion — shoulder elevation for overhead hand positions
**Prerequisite:** Position-aware pole vectors (completed)

## Problem

When the avatar's hands go above shoulder height (north positions, overhead reaches), the clavicle/shoulder bones remain static. This makes the avatar look stiff and robotic — real humans naturally elevate their clavicles when raising their arms, contributing roughly 1/3 of total arm elevation above 90 degrees.

## Solution

A new stateless service (`ClavicleRaiser`) that computes clavicle bone rotation based on how far the hand target is above shoulder rest height. Applied before IK solving so the arm chain starts from the elevated shoulder position.

## Anatomy Reference

The scapulohumeral rhythm (Inman et al., 1944; updated by Ludewig et al., 2009):
- Below ~60° arm elevation: clavicle contribution is minimal
- 60°–180° arm elevation: clavicle contributes ~1° for every 2-3° of arm elevation
- Maximum clavicle elevation: ~25-30° (varies by individual)
- Primary rotation axis: roughly the Z axis in skeleton space (forward roll of the shoulder)
- Secondary: slight posterior tilt and axial rotation (we'll skip these for now — the primary elevation is what's visually important)

## Architecture

### New Service

```
src/lib/shared/3d/
  services/
    contracts/IClavicleRaiser.ts
    implementations/ClavicleRaiser.ts
```

**Interface:**

```typescript
export interface IClavicleRaiser {
  computeClavicleRotation(
    handTarget: Vector3,
    side: "left" | "right",
    shoulderRestY: number
  ): Quaternion;
}
```

Single method. Pure function. No state. Returns a quaternion to apply to the clavicle bone.

### Parameters

- `handTarget`: world-space position of the hand IK target
- `side`: which shoulder — determines rotation direction
- `shoulderRestY`: the Y position of the shoulder at rest (no elevation). Obtained once from the skeleton's rest pose.

### Computation

```
elevationAboveShoulder = max(0, handTarget.y - shoulderRestY)
armReachAboveShoulder = totalArmLength  // upper + lower arm length
elevationRatio = clamp(elevationAboveShoulder / armReachAboveShoulder, 0, 1)
```

The clavicle rotation angle follows a curve:
- 0% elevation ratio → 0° clavicle rotation
- Below ~30% (hand near shoulder height): minimal rotation (ease-in)
- 30%-100%: scales to MAX_CLAVICLE_ELEVATION (25°)

Using an ease-in curve (quadratic or smoothstep) rather than linear ensures the clavicle doesn't visibly twitch for small hand movements near shoulder height.

```
MAX_CLAVICLE_ELEVATION = 25 degrees (0.436 radians)
ACTIVATION_THRESHOLD = 0.15  // below this ratio, no rotation

if elevationRatio < ACTIVATION_THRESHOLD:
  angle = 0
else:
  normalizedRatio = (elevationRatio - ACTIVATION_THRESHOLD) / (1 - ACTIVATION_THRESHOLD)
  angle = smoothstep(normalizedRatio) * MAX_CLAVICLE_ELEVATION
```

The rotation quaternion is constructed around the skeleton's local Z axis:
- Left shoulder: positive Z rotation (lifts left shoulder)
- Right shoulder: negative Z rotation (lifts right shoulder)

Note: The exact axis may need tuning based on the GLTF model's bone orientation. The implementation should derive the rotation axis from the bone's rest pose rather than hardcoding an axis.

### Integration into AvatarAnimator

In `applyIKToSkeleton()`, **before** the IK solve for each arm:

1. Get the clavicle bone: `state.bones.get("LeftShoulder")` / `state.bones.get("RightShoulder")`
2. Compute target rotation via `ClavicleRaiser`
3. Slerp current bone quaternion toward target (using `smoothingFactor`)
4. Apply to bone and update world matrix
5. Proceed with IK solve (which now uses the elevated shoulder position as chain root parent)

This ordering is critical: the clavicle elevation changes where the IK chain root is in world space, so the IK solver naturally accounts for it.

### Obtaining shoulderRestY

On skeleton load (in `AvatarAnimator` constructor or init), capture the world-space Y position of the LeftArm bone (the IK chain root, which is the child of the clavicle). This is the "rest height" of the shoulder. Since the avatar can be scaled via `setHeight()`, this value should be re-captured after any height change.

Alternatively, compute it each frame from the Hips bone Y + a fixed ratio. The per-frame approach is simpler and handles height changes automatically.

Simpler approach chosen: use `bodyCenter.y + SHOULDER_HEIGHT_OFFSET` where `SHOULDER_HEIGHT_OFFSET` is a proportion of avatar height (~0.35 of total height from hips). Since we already compute `bodyCenter` for pole vectors, this adds no new bone lookups.

## Backward Compatibility

- `ClavicleRaiser` is optional in `AvatarAnimator` (same pattern as `ElbowPoleComputer`)
- If not provided, clavicle bones remain static (current behavior)
- No interface changes to `IIKSolver` or `IKTarget`

## Files Changed

| File | Change |
|------|--------|
| `services/contracts/IClavicleRaiser.ts` | New — interface |
| `services/implementations/ClavicleRaiser.ts` | New — implementation |
| `services/implementations/AvatarAnimator.ts` | Accept optional `ClavicleRaiser`, apply before IK |
| `components/Avatar3D.svelte` | Instantiate and pass `ClavicleRaiser` |
| `tests/unit/3d-animation/ClavicleRaiser.test.ts` | New — unit tests |

## Testing

Pure math — ideal for unit tests:

1. **Hand below shoulder height:** Returns identity quaternion (no rotation)
2. **Hand at shoulder height:** Returns identity or near-zero rotation
3. **Hand well above shoulder:** Returns rotation up to MAX_CLAVICLE_ELEVATION
4. **Hand at maximum reach:** Rotation capped at MAX_CLAVICLE_ELEVATION
5. **Left vs right:** Opposite rotation directions
6. **All results are unit quaternions:** Length ≈ 1
7. **Smooth activation:** Small elevation above threshold produces small rotation (not a jump)

## Future: Spine Twist (Next in Pipeline)

The spine twist service would follow this exact same pattern:
- Reads hand positions, computes a rotation for Spine1/Spine2 bones
- Applied before IK, after clavicle raise
- The pipeline in `applyIKToSkeleton()` becomes: clavicle raise → spine twist → IK solve → (future: collision resolve)
