# Distributed Spine Twist for Avatar IK

**Date:** 2026-04-01
**Status:** Approved
**Scope:** Secondary motion — torso and head rotation for cross-body hand positions
**Prerequisites:** Position-aware pole vectors (completed), Clavicle raise (completed)

## Problem

When the avatar's hands reach across the body (cross-body positions), the spine stays perfectly rigid. Real humans rotate their torso and turn their head toward the reaching direction, which reframes the coordinate system — a cross-body reach becomes more like a front-body reach from the spine's perspective. This creates negative space and prevents the arms from fighting the torso.

## Anatomy Reference

**Thoracic spine (Spine1, Spine2):** ~47° total axial rotation capacity. The rib cage limits rotation in the mid-thoracic region. For cross-body reaching, a fraction (5-15°) is typical.

**Cervical spine (Neck, Head):** ~85° total axial rotation. 58% of cervical rotation happens at C1-C2 (atlas-axis). The head can turn dramatically to reframe the body's coordinate system during reaching tasks.

**Distribution principle:** Spinal rotation increases as you go up the chain. The lumbar spine barely rotates, the thoracic rotates moderately, and the cervical rotates the most. Game animation distributes twist evenly across a bone chain, but anatomically correct distribution weights the upper segments more heavily.

## Architecture

### New Service

```
src/lib/shared/3d/
  services/
    contracts/ISpineTwister.ts
    implementations/SpineTwister.ts
```

**Interface:**

```typescript
export interface ISpineTwister {
  computeSpineTwist(
    leftHandTarget: Vector3,
    rightHandTarget: Vector3,
    bodyCenter: Vector3
  ): SpineTwistResult;
}

export interface SpineTwistResult {
  spine1: Quaternion;
  spine2: Quaternion;
  neck: Quaternion;
  head: Quaternion;
}
```

Single method. Pure function. No state. Returns four quaternions — one per bone in the chain.

### Computing the Twist Signal

Two factors drive the twist:

**1. Lateral bias:** The average X offset of both hands relative to body center. When both hands are on the same side, the spine rotates toward them.

```
lateralBias = ((leftHand.x - bodyCenter.x) + (rightHand.x - bodyCenter.x)) / 2
```

**2. Cross-body tension:** When both hands individually cross the body's centerline (even in opposite directions), the combined reaching tension is high. This triggers a twist toward whichever side has more tension, creating negative space.

```
leftCross = max(0, -(leftHand.x - bodyCenter.x))   // left hand crossing to right
rightCross = max(0, (rightHand.x - bodyCenter.x))   // right hand crossing to left
// Note: sign conventions based on skeleton left = +X, right = -X

crossTension = leftCross + rightCross
```

The combined signal:
```
twistSignal = lateralBias + crossTension * CROSS_TENSION_WEIGHT
```

Clamped and normalized by `SHOULDER_HALF_WIDTH` (reuse the 0.2m constant from `ElbowPoleComputer`).

### Constants

```typescript
// Maximum total twist distributed across all four bones (~25 degrees)
MAX_TOTAL_TWIST = 25 degrees (0.436 radians)

// How much cross-body tension contributes vs lateral bias
CROSS_TENSION_WEIGHT = 0.3

// Distribution weights (must sum to 1.0)
// Increases up the chain: lower back barely moves, head leads
SPINE1_WEIGHT = 0.15   // ~4° max
SPINE2_WEIGHT = 0.25   // ~6° max
NECK_WEIGHT   = 0.25   // ~6° max
HEAD_WEIGHT   = 0.35   // ~9° max
```

### Computation

```
normalizedSignal = clamp(twistSignal / SHOULDER_HALF_WIDTH, -1, 1)
totalAngle = normalizedSignal * MAX_TOTAL_TWIST

spine1Angle = totalAngle * SPINE1_WEIGHT
spine2Angle = totalAngle * SPINE2_WEIGHT
neckAngle   = totalAngle * NECK_WEIGHT
headAngle   = totalAngle * HEAD_WEIGHT
```

Each quaternion is constructed as a Y-axis rotation (axial rotation around the spine's vertical axis). The rotation axis is `(0, 1, 0)` in each bone's local space.

Note: As with the clavicle raise, the exact rotation axis may need tuning based on the GLTF model's bone orientation. The implementation should start with Y-axis rotation and adjust if the model's local Y doesn't align with the spine's vertical axis. The diagnostic `__dumpShoulders()` pattern can be extended to dump spine bone axes.

### Integration into AvatarAnimator

In `applyIKToSkeleton()`, after clavicle raise and before IK solve:

1. Compute twist via `SpineTwister` using both hand targets and body center
2. For each bone (Spine1, Spine2, Neck, Head):
   a. Look up bone from `state.bones`
   b. Slerp toward target quaternion (using `smoothingFactor`)
   c. Compose with rest quaternion: `bone.quaternion = restQuat * twistQuat`
   d. Call `bone.updateMatrixWorld(true)`
3. Proceed with IK solve

The pipeline in `applyIKToSkeleton()` is now:
```
clavicle raise → spine twist → pole vectors + IK solve
```

### Rest Quaternion Caching

Same pattern as clavicle raise (learned from the "smushed shoulders" bug): cache rest quaternions for Spine1, Spine2, Neck, and Head on first frame. Compose rotations on top of rest, never replace.

## Backward Compatibility

- `SpineTwister` is optional in `AvatarAnimator` (same pattern as previous services)
- If not provided, spine bones remain static (current behavior)
- Constructor gains one more optional parameter
- No interface changes to `IIKSolver` or `IKTarget`

## Files Changed

| File | Change |
|------|--------|
| `services/contracts/ISpineTwister.ts` | New — interface + `SpineTwistResult` type |
| `services/implementations/SpineTwister.ts` | New — implementation |
| `services/implementations/AvatarAnimator.ts` | Accept optional `SpineTwister`, apply after clavicle / before IK |
| `components/Avatar3D.svelte` | Instantiate and pass `SpineTwister` |
| `tests/unit/3d-animation/SpineTwister.test.ts` | New — unit tests |

## Testing

Pure math — ideal for unit tests:

1. **Hands balanced (one left, one right, equidistant):** All quaternions near identity (no twist)
2. **Both hands offset left:** All quaternions rotate left (positive Y rotation), head rotates most
3. **Both hands offset right:** All quaternions rotate right (negative Y rotation)
4. **Cross-body: left hand far right, right hand far left:** Nonzero twist driven by tension
5. **Distribution weights:** Head rotation angle > Neck > Spine2 > Spine1 for same input
6. **Maximum twist capped:** Extreme positions don't exceed MAX_TOTAL_TWIST
7. **All results are unit quaternions**
8. **Smooth response:** Small lateral changes produce proportional small rotations

## Debug Toggle

`window.__toggleSpineTwist()` — same pattern as pole vectors and clavicle raise.

## Sources

- [Biomechanics of the Spine: ROM](https://www.anatomystandard.com/biomechanics/spine/rom-of-spine.html) — thoracic 47° / cervical 85° axial rotation
- [Spine ROM of Separate Vertebrae](https://www.anatomystandard.com/biomechanics/spine/rom-of-vertebrae.html) — per-segment rotation data
- [Coupled Movements of the Spine - WikiMSK](https://wikimsk.org/wiki/Coupled_Movements_of_the_Spine) — coupling between axial rotation and lateral bending
- [Dead and Buried Character Animation](https://developers.meta.com/horizon/blog/developer-perspectives-character-animation-in-dead-and-buried/) — distributed spine twist in VR game animation
