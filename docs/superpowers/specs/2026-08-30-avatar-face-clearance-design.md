# Avatar Face Clearance

**Date:** 2026-08-30  
**Status:** Approved by Austen in conversation  
**Scope:** Shared two-bone arm routing and head reflex used by `Avatar3D`

## Outcome

Raised and cross-body forearms must not pass through the avatar's face. The
hands remain fixed to their authored prop targets while the elbow takes the
nearest safe bend plane. If no elbow route can provide enough room, the neck
and head retreat from the forearm as a bounded reflex.

## Production evidence

The production sequence was sampled at rendered-frame cadence using the same
face sphere and forearm capsules as `CollisionDetector`:

| Avatar            | Minimum face-to-forearm distance | Worst penetration |
| ----------------- | -------------------------------: | ----------------: |
| Austen MetaPerson |                           2.7 cm |           12.3 cm |
| Remy              |                           6.1 cm |            8.9 cm |
| X-Bot             |                           6.3 cm |            8.7 cm |

The shared collision envelope requires 15 cm of centerline clearance. During
the worst Austen frame, the right hand target was 73.4 cm from the shoulder
while the arm's measured reach was only 55.6 cm. The elbow circle therefore
collapsed near full extension: the elbow resolver improved the minimum
clearance only from 2.7 cm to 2.9 cm because no safe bend plane existed. This
is a morphology-sensitive reach and self-collision problem, not a bad bone map
or a staff collision.

The final 0.8-radian reflex improved the conservative shoulder-aligned metric
to 6.3 cm. That metric intentionally does not rotate its face proxy after the
head moves, so it understates the visible clearance. The decisive production
check used two synchronized Austen instances at the measured worst frame: the
unpatched instance's head disappeared behind the forearms, while the patched
instance retained a visible gap from the hairline through the full arm
transition.

## Research basis

Unity's official two-bone IK constraint keeps the end target independent from
the hint that selects the middle-joint bend direction. That is the same
separation already used by this package: the hand target owns contact and the
pole hint owns the elbow corridor.

- <https://docs.unity3d.com/Packages/com.unity.animation.rigging@1.2/manual/constraints/TwoBoneIKConstraint.html>
- <https://arxiv.org/abs/2109.07431>

Contact-aware retargeting research also treats self-contact as a geometric
constraint that must survive morphology changes. The runtime measurements show
why that matters here: identical authored motion produces substantially
different penetration depths on different bodies.

## Capability ownership

Search terms: `headDodge`, `arm-through-face`, `collision avoidance`,
`forearm`, `elbow pole`, and `self-collision`.

- `AvatarAnimator` continues to own evaluation order and live skeleton data.
- `ElbowPoleComputer` is extended as the owner of the elbow bend plane.
- `IKSolver` remains the exact two-bone solve and is not replaced.
- `CollisionDetector` remains the diagnostic judge and does not mutate poses.
- Shared face and segment geometry has one pure module so detection and
  avoidance cannot silently disagree about where the face is.

This extends existing owners. It does not introduce a parallel IK system.

## Solver design

For a fixed shoulder, hand target, upper-arm length, and forearm length, every
valid elbow lies on a circle around the shoulder-to-hand axis. The resolver:

1. projects the existing semantic pole onto that circle;
2. predicts the resulting elbow and face-to-forearm distance;
3. if unsafe, searches clockwise and counter-clockwise in five-degree steps;
4. binary-refines the nearest safe boundary; and
5. returns the smallest pole change that clears the shared collision envelope.

The hand target never changes. When neither direction can clear the face, the
resolver returns the maximum-clearance pole and the post-IK head reflex uses
the actual solved forearm capsule as an additional threat. Forearm threats
always retreat opposite the measured chest-forward axis, which makes the
character move its head backward instead of following the collision normal
forward or choosing an unstable random side. The combined neck/head retreat is
capped at 0.8 radians (about 46 degrees), distributed 60/40 across the two
joints and smoothed independently on attack and release.

Self-collision avoidance runs whenever arm IK is active. It does not depend on
the optional staff-dodge flag; live instrumentation proved that production
passes `headDodge={true}` at the wrapper while the active animator can still
hold `headDodgeEnabled: false`.

The resolver runs after ordinary plane, height, and over/under pole semantics
have been computed. Existing motion language therefore survives whenever it is
already safe.

## Files and delivery

- `patches/@austencloud__scene-3d@0.1.6.patch`
- `pnpm-lock.yaml` patch hash
- `tests/unit/3d-animation/ElbowPoleComputer.test.ts`
- this design record

The package patch contains source and generated distribution output. The
personal MetaPerson asset remains evaluation-only and is not added to Git.

## Verification

1. Pure geometry tests prove the resolver preserves hand accuracy, returns a
   normalized pole, clears a synthetic face collision, and stays finite when
   the fixed hand target makes full clearance impossible.
2. Existing paired routing, spine, grip, and IK tests remain green.
3. The changed package files type-check directly. The repository-wide check is
   captured separately so unrelated baseline errors cannot be mistaken for
   failures in the collision work.
4. A synchronized production comparison at the measured worst frame proves
   the patched Austen keeps his face visible while the unpatched clone clips.
   The full loop preserves hand targets and shows no elbow reversal or visible
   head snap.
