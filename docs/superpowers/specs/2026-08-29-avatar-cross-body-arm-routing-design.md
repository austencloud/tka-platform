# Avatar Cross-Body Arm Routing

**Date:** 2026-08-29  
**Status:** Approved by Austen in conversation  
**Scope:** Shared avatar posture and two-bone arm IK used by `Avatar3D`

## Outcome

Crossed wall-plane reaches must preserve both hand targets while the body
creates enough negative space for the arms to pass one another. The chest
leans forward, one forearm takes a stable over route, the other takes an under
route, and neutral elbows bend away from the ribcage instead of folding toward
it. The behavior must work from the skeleton's measured shoulder line rather
than assuming a particular exporter axis convention.

## Evidence

The personal MetaPerson, the Avatar SDK sample, and the Human Generator export
all place the mapped left shoulder on positive model X and the mapped right
shoulder on negative model X. The runtime previously treated positive model X
as the body's right side. That inversion meant:

- natural reaches were classified as cross-body;
- actual crossed reaches were classified as natural;
- `SpineTwister`'s existing forward-pitch branch stayed at zero; and
- both arms received the same wall-plane pole, so their forearms occupied the
  same chest corridor.

The current Three.js addon supplies a CCD chain solver and per-link rotation
limits, but it does not provide paired-limb or torso self-collision routing:
<https://threejs.org/docs/pages/CCDIKSolver.html>. Unity's official two-bone IK
notes make the bend hint the disambiguating input for straight limbs, while
Epic's Full-Body IK documentation uses per-joint preferred angles and allows
the torso to participate in a reach. Those systems support extending the
existing pole and spine owners rather than replacing the exact analytic
two-bone solver:

- <https://docs.unity3d.com/Packages/com.unity.animation.rigging@1.2/manual/constraints/TwoBoneIKConstraint.html>
- <https://dev.epicgames.com/documentation/unreal-engine/control-rig-full-body-ik-in-unreal-engine>

## Canonical owners

Search terms used before design: `cross-body`, `self-intersection`,
`arm collision`, `torso pitch`, `over/under`, and `forearm`.

- `AvatarAnimator` owns evaluation order and paired-arm context.
- `SpineTwister` owns torso participation in crossed reaches.
- `ElbowPoleComputer` owns elbow bend direction for each plane.
- `IKSolver` remains the exact two-bone solve and is not replaced.
- `CollisionDetector` remains the diagnostic owner; it does not mutate poses.

This change **extends** the first three owners. It does not add a parallel IK,
posture, or collision system.

## Design

### Anatomical body frame

Each frame, `AvatarAnimator` measures the mapped arm roots before posture is
applied. The normalized vector from the left arm root to the right arm root is
the body's anatomical-right axis. The skeleton root still supplies the forward
axis. A degenerate or incomplete rig falls back to the current root axes.

All cross-body tests and lateral pole components operate in that measured body
frame. The result is independent of whether an exporter calls anatomical left
positive X or negative X, and it survives wrapper yaw.

### Stable paired routing

`ElbowPoleComputer` gains a pure paired-routing calculation. When both hands
cross their anatomical centerline beyond the engagement threshold:

1. the higher hand receives the over route;
2. targets at effectively equal height use the left hand as a deterministic
   tie-breaker; and
3. the complementary arm receives the under route.

The over route adds upward and forward pole bias. The under route adds downward
bias while retaining forward chest clearance. Both keep a lateral outward
component derived from the body frame. Existing pole smoothing in
`AvatarAnimator` makes transitions continuous.

This changes only the elbow solution plane. Hand and palm socket targets remain
unchanged.

### Torso participation

Once the anatomical-right axis is correct, `SpineTwister`'s existing symmetric
cross factor activates. Its forward pitch is applied before arm IK, moving the
shoulders toward the prop plane while the hands remain fixed. The maximum may
be calibrated within the existing bounded forward-pitch constant during visual
verification; no second hunch control is introduced.

### Neutral anatomy

Wall-plane poles include a persistent, modest outward component, strengthened
when a target is below its shoulder. This replaces the current hips-relative
low test, which does nothing for ordinary chest-height holds. The component is
expressed in the measured body frame, so left and right remain mirror images on
every supported rig convention.

## Files and boundaries

The implementation is delivered through the canonical
`@austencloud/scene-3d` patch and its lockfile hash, plus focused repository
tests. The obsolete app-local elbow-pole duplicate is removed so tests execute
the package code that production imports.

The personal MetaPerson GLB remains ignored and evaluation-only. This work does
not register, publish, or deploy that asset.

## Verification

1. Pure routing tests prove body-frame invariance, mirrored neutral poles,
   stable equal-height layering, and unit-length results.
2. A two-chain regression proves crossed targets retain hand accuracy while
   the solved elbows take distinct over/under corridors.
3. Existing spine and reach tests remain green.
4. `svelte-check` passes for the changed package integration.
5. Live bakeoff proof covers neutral, cross-body, overhead, depth, and low poses
   on the personal MetaPerson plus at least one legacy candidate. Cross-body
   must show forward torso participation and no arm-arm or arm-torso
   interpenetration from front and quarter views.

