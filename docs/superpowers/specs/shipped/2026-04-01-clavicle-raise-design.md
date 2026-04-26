# Clavicle Raise for Avatar IK

**Date:** 2026-04-01
**Status:** Approved
**Scope:** Secondary motion — shoulder elevation for overhead hand positions
**Prerequisite:** Position-aware pole vectors (completed)

## Problem

When the avatar's hands go above shoulder height (north positions, overhead reaches), the clavicle/shoulder bones remain static. This makes the avatar look stiff and robotic — real humans naturally elevate their clavicles when raising their arms. Unity's built-in IK has this same limitation; FinalIK's ShoulderRotator is the industry standard solution.

## Anatomy: Scapulohumeral Rhythm

Research-backed breakdown of how the shoulder actually works during arm elevation:

**The 2:1 ratio:** For every 2° of arm elevation, ~1° comes from scapular/clavicle movement (Inman 1944, confirmed by modern studies with measured range 1.25:1 to 3.2:1).

**Three phases of arm abduction:**

| Phase | Arm Angle | What Happens | Clavicle |
|-------|-----------|-------------|----------|
| Setting | 0°–30° | Humerus moves, scapula barely moves | No elevation |
| Mid-range | 30°–90° | Scapula rotates ~20°, humerus ~40° | Begins elevating |
| Overhead | 90°–180° | 2:1 ratio continues | Elevates up to ~15°, posteriorly rotates 30°–50° |

**Key number:** Maximum clavicle elevation at the sternoclavicular joint is approximately **15°**. The clavicle carries the scapula upward, accounting for half of the scapula's total 60° upward rotation during full abduction.

**What we model:** Primary clavicle elevation (the upward tilt). We skip posterior rotation and axial rotation — the elevation is what's visually dominant and what game engines like FinalIK focus on.

## Industry Reference: FinalIK ShoulderRotator

The gold standard in game animation (used in thousands of Unity titles):

- **ShoulderWeight:** 0-1 float controlling how strongly the shoulder rotates (default ~0.5)
- **ShoulderOffset:** How far the hand must move above shoulder before rotation activates
- **Technique:** Rotate the clavicle bone **before** the IK solver reads the pose
- **AdvIKPlugin** extends this with configurable weight + offset parameters

Our implementation follows this same pattern.

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
    shoulderRestY: number,
    armLength: number
  ): Quaternion;
}
```

Single method. Pure function. No state. Returns a quaternion to apply to the clavicle bone.

### Parameters

- `handTarget`: world-space position of the hand IK target
- `side`: which shoulder — determines rotation direction
- `shoulderRestY`: Y position of the shoulder at rest (no elevation)
- `armLength`: total arm length (upper + lower). Used to normalize the elevation ratio so the same code works regardless of avatar scale.

### Constants

```typescript
// Maximum clavicle elevation angle — from biomechanics research
// Real humans: ~15° at the sternoclavicular joint during full abduction
MAX_CLAVICLE_ELEVATION = 15 degrees (0.262 radians)

// How much of the arm length must be exceeded before clavicle activates
// Maps to the "setting phase" (0°-30° abduction) where clavicle barely moves
ACTIVATION_THRESHOLD = 0.2  // 20% of arm length above shoulder

// Tuning weight — how strongly the clavicle responds (FinalIK-style)
// 1.0 = full anatomical response, 0.5 = half, 0.0 = disabled
DEFAULT_WEIGHT = 1.0
```

### Computation

```
elevationAboveShoulder = max(0, handTarget.y - shoulderRestY)
elevationRatio = clamp(elevationAboveShoulder / armLength, 0, 1)

if elevationRatio < ACTIVATION_THRESHOLD:
  angle = 0
else:
  // Remap to 0-1 range above the threshold
  normalizedRatio = (elevationRatio - ACTIVATION_THRESHOLD) / (1 - ACTIVATION_THRESHOLD)
  // Smoothstep for natural ease-in (avoids twitching near threshold)
  smoothed = normalizedRatio * normalizedRatio * (3 - 2 * normalizedRatio)
  angle = smoothed * MAX_CLAVICLE_ELEVATION * weight
```

The rotation quaternion is constructed around the skeleton's local Z axis:
- Left shoulder: positive Z rotation (lifts left shoulder upward)
- Right shoulder: negative Z rotation (lifts right shoulder upward)

Note: The exact rotation axis depends on the GLTF model's bone orientation. If the model uses a different convention, the axis will need adjustment during implementation. The tests verify the rotation magnitude and direction, not the specific axis.

### Integration into AvatarAnimator

In `applyIKToSkeleton()`, **before** the IK solve for each arm:

1. Get the clavicle bone: `state.bones.get("LeftShoulder")` / `state.bones.get("RightShoulder")`
2. If bone exists and `clavicleRaiser` is provided:
   a. Compute target rotation via `ClavicleRaiser`
   b. Slerp current bone quaternion toward target (using `smoothingFactor`)
   c. Apply to bone
   d. Call `bone.updateMatrixWorld(true)` to propagate to child bones
3. Proceed with IK solve (which now starts from the elevated shoulder position)

This ordering is critical: the clavicle elevation changes where the IK chain root (`LeftArm`) is in world space, so the IK solver naturally accounts for it.

### Obtaining shoulderRestY and armLength

Both values come from the existing skeleton data:
- `shoulderRestY`: Get world position of `LeftArm`/`RightArm` bone (IK chain root) at rest. Cache per skeleton load.
- `armLength`: Already available as `chain.totalLength` (= `chain.upperLength + chain.lowerLength`) on the `BoneChain`.

Since `bodyCenter` is already computed each frame for pole vectors, and the arm chains are already fetched, this adds minimal overhead.

## Backward Compatibility

- `ClavicleRaiser` is optional in `AvatarAnimator` (same pattern as `ElbowPoleComputer`)
- If not provided, clavicle bones remain static (current behavior)
- No interface changes to `IIKSolver` or `IKTarget`
- Constructor gains one more optional parameter

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
2. **Hand at shoulder height:** Returns identity quaternion (within activation threshold)
3. **Hand slightly above threshold:** Returns small positive rotation (smooth ease-in, no jump)
4. **Hand well above shoulder:** Returns rotation approaching MAX_CLAVICLE_ELEVATION
5. **Hand at maximum reach (armLength above shoulder):** Rotation capped at MAX_CLAVICLE_ELEVATION (15°)
6. **Left vs right:** Opposite rotation directions (positive Z vs negative Z)
7. **All results are unit quaternions:** Length ≈ 1
8. **Monotonic increase:** Higher hand → equal or greater rotation angle (never decreases)

## Debug Toggle

Add `window.__toggleClavicleRaise()` (same pattern as pole vector toggle) for A/B comparison during development.

## Future: Spine Twist (Next in Pipeline)

The spine twist service follows this exact same pattern:
- Reads hand positions, computes a rotation for Spine1/Spine2 bones
- Applied before IK, after clavicle raise
- The pipeline in `applyIKToSkeleton()` becomes: clavicle raise → spine twist → IK solve → (future: collision resolve)

## Sources

- [Scapulohumeral Rhythm - Physiopedia](https://www.physio-pedia.com/Scapulohumeral_Rhythm) — canonical biomechanics reference
- [Scapulohumeral Rhythm Degrees - Hand Therapy Academy](https://www.handtherapyacademy.com/treatments/increase-shoulder-range-by-improving-scapulohumeral-rhythm/) — phase breakdown with degree values
- [FinalIK ShoulderRotator](http://www.root-motion.com/finalikdox/html/page8.html) — industry-standard game implementation
- [AdvIKPlugin (GitHub)](https://github.com/OrangeSpork/AdvIKPlugin) — extended shoulder rotation with weight/offset params
- [Unity Animation Rigging - Procedural Poses](https://unity.com/resources/procedural-poses-motion-animation-rigging) — Unity's official procedural animation guide
- [Unity Discussion: Shoulder pull after TwoBone IK](https://discussions.unity.com/t/animation-rigging-proper-way-to-pull-shoulder-a-bit-after-twobone-ik-constraint/786976) — community solution for same problem
