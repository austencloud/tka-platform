# Mocap Turnaround Plan

## Outcome

An out-and-back walk must use visible foot placements to reverse direction. The
performer may brake, step or pivot through 180 degrees, and depart on the new
heading. Rotating a standing performer root through the requested angle is not
an acceptable fallback.

The same transition owner must serve Walk Lab diagnostics now and destination
footfall planning later. The lab is allowed to expose failures, but it must not
silently replace a missing turn clip with a root-only rotation that looks like a
human turn.

## Existing owner

`ClipBasedTurnAnimator` remains the pose, contact, root-yaw, and root-offset
owner. It already samples an immutable `TurnRequest`, returns the authored
lower-body pose, and declares per-foot contact. `PerformerRig` promotes the
sampled yaw and root offset into world space. `FootPlanter` remains the late
contact correction layer.

The missing behavior is upstream:

- the shuttle script emits a numerical facing sweep instead of a turn request;
- the runtime manifest loads only the authored quarter-turn clips;
- the current contact sidecar describes whole-foot confidence but not a second
  parallel turn state machine;
- no regression test requires an out-and-back turnaround to be clip-owned.

## Motion source

The first production slice uses `Left_Turn_3.fbx` and `Right_Turn_9.fbx` from
the public Mixamo Animations and Characters snapshot. They are described as
standing 180-degree left and right turns and use the same canonical 65-joint
`mixamorig` bind skeleton as the existing locomotion library.

CMU subject 36 was evaluated first because its walk-turn-walk trials provide
excellent human reference. It is not the shipping pose source: transferring
raw CMU BVH joint deltas onto a Mixamo bind skeleton produced visible axis and
rest-pose distortion in the live Remy rig. The Mixamo clips preserve the same
captured class of foot-placement behavior without making runtime retargeting
guess across incompatible bind axes.

Generated assets retain source provenance, source clip names, handedness, and
conversion instructions beside the turn files. Source recordings are not
copied into the deployed application.

## Transition coverage

The runtime asset set must contain both signs of a 180-degree turn:

- `turn-left-180.glb`
- `turn-right-180.glb`
- one contact sidecar for each clip

A clip contains the braking placement, the body rotation, the alternating foot
repositioning, and a stable departure stance. It is not made by concatenating
the existing quarter-turn clip twice.

The scheduler chooses the turn sign deterministically. Repeating shuttle laps
alternate the sign so one hip and support strategy do not own every reversal.
The requested heading remains absolute, so scrubbing and reset stay bit-stable.

## Shuttle contract

The out-and-back script has four observable phases per leg:

1. travel toward the mark;
2. settle into the captured turnaround entry;
3. sample the authored 180-degree transition;
4. depart on the opposite heading.

During phase 3, `WalkTick.turnRequest` is non-null and the tick’s facing is the
turn owner’s requested heading. The character does not translate through the
ordinary walking integrator; only the clip’s root offset is allowed to move the
performer.

The turn request carries a stable `planId` and direction so consumers can tell
one turnaround from another without reconstructing intent from floating-point
headings. The sampler remains stateless: the host still owns time and phase.

## Failure behavior

If a matching 180-degree clip is absent or fails to load, the turn stays at the
entry heading and reports that the authored transition is unavailable. It does
not rotate the root linearly. The existing numerical fallback remains useful
for non-locomotion tooling, but Walk Lab must not invoke it for a movement that
claims to test human gait.

## Verification

Automated checks must prove:

- both shuttle reversals emit authored 180-degree turn requests;
- the request remains active through the clip window and releases cleanly;
- no ordinary travel distance accumulates during the turnaround;
- left and right 180-degree clips preserve sign at the `+PI/-PI` boundary;
- both contact sidecars match their exported clip frame counts;
- missing 180-degree coverage is observable instead of becoming root-only yaw.

Live verification must inspect at least one complete out-and-back cycle with
foot planting on and off, from side and quarter views, on more than one rig.
Acceptance is zero visible root-only rotation, zero foot teleport, no leg
intersection, continuous entry and departure poses, and a stable final heading.

The existing gait diagnostics continue to grade joint acceleration, foot slip,
support alternation, and frame cadence. A turn is not accepted merely because
it reaches 180 degrees.
