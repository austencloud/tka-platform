# Exact-Step Locomotion Design

## Outcome

A caller gives the walking system a start position, a world-space destination,
and an integer number of steps. The system produces the travel between those
points, reaches the destination on the requested footfall, and never corrects
the result with an endpoint snap.

This is a gait contract, not a path-duration contract. A move that reaches the
right mark after four seconds but takes seven footfalls instead of six is
wrong.

## Evidence from the current system

Walk Lab currently integrates `commandedSpeed * delta` in `WalkDriver`. The
film director samples an eased position track and differentiates it to recover
the speed sent to the rig. Both paths know where the performer is, but neither
can observe the locomotion animator's footfall clock.

`LocomotionAnimator` already owns the information that defines a step:

- one shared, phase-aligned gait cycle across the four directional clips;
- clip-specific left-foot strike alignment;
- blended cadence;
- stride scale; and
- left/right contact curves.

Its public contract exposes contact and stride scale, but not gait phase or a
monotonic step coordinate. That missing seam is why an exact-step planner
cannot be integrated without either duplicating animator math or guessing at
steps from rendered joints after the fact.

## Ownership

The responsibilities stay separate:

1. `LocomotionAnimator` owns the gait clock. It exposes a read-only snapshot
   containing normalized phase, a monotonic authored-step coordinate, cadence,
   and stride scale. It does not move the performer.
2. The shared destination planner owns geometric intent. It turns
   start + destination + step count into one immutable plan and samples a
   world position from progress on the animator's step coordinate.
3. A host such as Walk Lab or the film director owns execution. It records the
   gait coordinate at departure, samples the plan every frame, and stops
   feeding movement on the requested terminal footfall.
4. `FootPlanter` remains the sole owner of stance locks and leg IK. The planner
   never infers contact or edits bones.

## Gait-clock contract

The clock reports authored biped steps, not frames and not approximate events
from a diagnostic probe.

- `phase` is the animator's shared gait-cycle phase in `[0, 1)`.
- `step` is monotonic while the animator advances. Each full gait cycle adds
  exactly two: one left step and one right step.
- `cadence` is authored steps per second after playback-rate scaling.
- `strideScale` is the same value the foot planter consumes.
- `moving` says whether the current directional blend is advancing the clock.

The initial seam treats the two authored steps in a cycle as the canonical
count. A later asset pass may add measured right-strike phase to make the
fractional coordinate follow asymmetric clips more precisely; that refinement
must preserve the integer coordinate at each completed cycle.

## Destination-plan contract

Given `from`, `to`, `steps`, and an optional comfortable cadence:

- `steps` must be a positive integer;
- all coordinates and cadence must be finite;
- every step boundary is `from + (to - from) * i / steps`;
- sampling is clamped, monotonic, and frame-rate independent;
- the terminal sample equals `to` exactly by construction; and
- the planner returns the required mean step length so the animation layer can
  reject implausible requests or apply stride warping deliberately.

The first implementation is a straight mark-to-mark plan. Curved paths need
arc-length parameterization so equal steps remain equal distances; they are a
separate extension, not a hidden easing curve.

## Terminal-step semantics

The requested count includes the closing footfall. The final requested step is
therefore not one more sample of the perpetual walk loop followed by an
uncounted shuffle into idle. It is a terminal step whose swing foot lands into
a stable stopping stance while the root reaches the destination.

That interpretation is the only one that satisfies all three parts of the
contract at once:

- the destination is reached on step `N`;
- no step `N + 1` is hidden inside the idle transition; and
- neither foot has to skate from a wide mid-stride pose into the idle stance.

The animator owns that final window because it already owns gait phase,
contact, clip selection, cadence, and stride scale. `FootPlanter` may keep the
terminal stance foot anchored, but it must not invent the swing trajectory or
decide which footfall counts. The destination planner continues to own only
the root's geometric progress.

## State-of-the-art reference

The design follows the same separation used by modern game locomotion:
distance matching selects animation progress from distance, stride warping
matches the pose to capsule speed, and motion warping guarantees a target
transform over a declared window. TKA's web stack does not have those engine
nodes, so the equivalent must be explicit: one gait clock, one distance plan,
and one controlled bridge between them.

## Acceptance

Automated:

- every integer step boundary is evenly spaced;
- the terminal sample is bit-stable at the requested destination;
- invalid step counts and non-finite inputs are rejected;
- different frame partitions produce the same sampled positions for the same
  gait coordinate; and
- the animator's step coordinate never wraps when phase does.

Live Walk Lab:

- exposes a mark-to-mark case with destination and step count;
- displays requested steps, completed authored steps, endpoint error, mean step
  length, and the existing gait-quality metrics together;
- reaches the mark without a final position snap;
- has zero joint teleports and zero knee twitches over a full move; and
- does not ship as complete while foot slip, cycling in place, or weight
  transfer remain outside the lab's human-range thresholds.

For exact moves the live readout separates two windows. **Walking** contains
only the latest contiguous root-travel segment, trimmed at its loading and stop
boundaries. **Arrival** overlaps the last tenth of a second of travel and keeps
the next 0.85 seconds, so a boundary teleport cannot disappear between two
reports. Recording then freezes until the next reset. Cadence and support
timing are walking metrics; the arrival view reports only slip, heel lift,
joint acceleration, knee jerk, and cycling.

## Current boundary

The straight-path executor now uses the gait clock as its progress source and
lands on the requested mark without an endpoint correction. Walk Lab also
limits its exact-step picker to mean step lengths between 55 and 85 cm, so the
diagnostic cannot request a three-step eight-metre walk and mistake the result
for a locomotion failure.

The live 8 m / 12 step case proves the planning half: 0.0 cm endpoint error,
no backwards progress, and a largest measured root advance of 1.90 cm in one
rendered frame. It does not prove a production-quality stop. Inside the steady
travel window the root is clean, but the gait still measures roughly 6.7 cm of
stance-foot slip and 2,894 deg/s² RMS knee jerk. At the endpoint, the system
freezes the loop phase and crossfades that arbitrary stride pose to idle. That
transition has no remaining-distance model, terminal foot owner, or authored
stop window, so it cannot promise an anchored final foot or a jolt-free settle.

The next production seam is therefore a terminal-step controller, not another
position correction. It must receive remaining distance, requested terminal
footfall, and step-length/cadence intent, then drive either an authored stop
clip through distance matching or a procedural stopping window with the stance
foot held. Until that owner exists, the exact mark planner is valid but the
walking system as a whole does not satisfy the top-tier motion acceptance
criteria.

A live procedural prototype that simply held both endpoint plants proved why
this seam cannot be skipped. It removed the stop jolt, but left Remy frozen in
a 73 cm split stance with the rear knee nearly straight. Letting both locks
fade produced the opposite failure: a normal idle pose reached through roughly
30 cm of visible foot travel. Both variants were rejected. The terminal step
must replace the final looped footfall, not clean up after it.
