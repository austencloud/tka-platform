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
- the declared step-length profile must sum exactly to the requested distance;
- the final two steps may shorten deliberately to express braking, while the
  preceding steps absorb the remaining distance without exceeding the
  comfortable-step-length envelope;
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

The bridge between those owners is `TerminalStepPlan`. It is armed at least
two authored steps before arrival and declares:

- the monotonic gait step where braking begins and the step where arrival must
  complete;
- the terminal foot and target facing;
- the remaining root distance and the two braking-step distances;
- the cadence used to time the authored transition; and
- the immutable plan identity used to reject stale transitions.

The selected stop asset supplies the normalized root-distance curve and
contact schedule. `LocomotionAnimator` maps that curve onto the plan's exact
remaining distance and holds the terminal pose after settle. `FootPlanter`
realizes the declared anchors during braking, landing, and settle. It remains a
late corrective layer rather than a transition generator.

## State-of-the-art reference

The design follows the same separation used by modern game locomotion:
distance matching selects animation progress from distance, stride warping
matches the pose to capsule speed, and motion warping guarantees a target
transform over a declared window. TKA's web stack does not have those engine
nodes, so the equivalent must be explicit: one gait clock, one distance plan,
and one controlled bridge between them.

## Acceptance

Automated:

- every integer step boundary follows the declared step-length profile;
- the complete profile sums to the requested distance and preserves a
  deliberate two-step braking window;
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

The straight-path executor uses the gait clock as its progress source and
lands on the requested mark without an endpoint correction. Walk Lab also
limits its exact-step picker to mean step lengths between 55 and 85 cm, so the
diagnostic cannot request a three-step eight-metre walk and mistake the result
for a locomotion failure.

The terminal-step seam now exists. The asset build produces left- and
right-terminal stop clips plus explicit contact and normalized root-distance
sidecars. `LocomotionAnimator` selects the requested terminal foot, starts the
transition two authored steps before arrival, distance-matches the clip to the
remaining plan, blends into the braking stride without a phase jump, and holds
the settled pose. The cyclic contact retargeter never rewrites the non-cyclic
stop asset.

Live warm-cache proof for Remy's 8 m / 12 step case:

- 8.0 m covered in exactly 12 authored steps with 0.0 cm endpoint error;
- 0.0 joint teleports per second over the complete walk, with a worst measured
  joint acceleration of 135 m/s²;
- terminal-window foot slip of 1.1 cm, heel lift of 1.4 cm, and knee jerk of
  945 deg/s²; and
- one remaining terminal knee twitch at roughly 1.1 events per second in the
  0.85-second arrival window.

The system is therefore exact and its terminal transition is close to the
declared arrival thresholds, but the full walk is not top-tier yet. The steady
travel window still measures roughly 6.2 cm of stance-foot slip, 11.8 cm of
mid-stance heel lift, 19.7 knee twitches per second, 3,287 deg/s² knee jerk,
and only 18% body-over-foot support. Disabling the current contact retarget and
planting layers makes those numbers substantially worse, while wider IK ramps
trade one failure for another.

The remaining production seam is authored steady-locomotion data, not another
per-frame IK heuristic. The asset pipeline needs phase-aligned root-motion
walks across useful speed bands, explicit foot contacts, believable pelvis
weight transfer, and more stop families keyed by speed and facing. A future
motion-matching database may select those clips, but the unfinished lab-only
motion-matching controller must not become a parallel runtime owner. Until the
steady dataset replaces the current loop/retarget trajectory, the walking
system does not satisfy the zero-twitch and human-range support acceptance
criteria.

## Locomotion-family architecture

Steady travel, lateral travel, turn-in-place, and stopping are separate motion
families. They share trajectory intent and late contact correction, but they do
not share a universal clip or a universal set of human-walk thresholds.

- **Steady travel** selects by future trajectory, gait phase, speed band, and
  desired facing. The gait clock now exposes `distanceStep` beside `step`:
  `step` remains the exact footfall/counting axis, while `distanceStep` follows
  the selected motion's reconstructed within-cycle root curve. A host can
  distance-match the world root without changing the requested step count.
- **Lateral travel** admits only lateral candidates and rejects any sampled
  pose whose feet reverse the left/right ordering of its thighs. The current
  lateral clips receive an offline clearance bake; hard world-space foot locks
  stay disabled until a selected candidate also supplies a matched root curve.
- **Turn-in-place** uses authored left/right quarter-turn clips with contact
  labels and sampled root yaw. The turn animator owns the visible body turn;
  the root banks the completed yaw at the seam, and FootPlanter realizes only
  the declared support windows.
- **Stopping** uses the existing terminal controller and left/right authored
  stop assets. It is selected at least two footfalls ahead and distance-matched
  to the remaining mark.

The diagnostic now chooses rows by maneuver family. A turn is no longer failed
for having no forward step length or for "cycling on the spot," and a sidestep
is not compared with forward-walk cadence and duty-factor ranges. Contact slip,
joint impulses, knee jerk, and leg self-crossing remain visible wherever they
are physically meaningful.

## Asset and database boundary

The repository can build authored stop and turn clips today and bake their
contact labels. It does not yet contain the steady/lateral database needed for
the final acceptance gate: phase-aligned speed bands, start/stop variants,
left/right terminal stance, clean root trajectories, and contact metadata.

The unfinished `MmLocomotionController` is the future database host. Its
extractor already records pose, feet, hip velocity, and future trajectory; its
search now supports intent-family admission and hard leg-clearance rejection.
It still does not invoke that search at runtime or transfer a selected
candidate's root/contact metadata to the animator. That controller must be
extended rather than placing a second motion-matching system beside it.

The minimal resolved candidate handed from selection to playback is:

```ts
interface ResolvedLocomotionCandidate {
  clipId: string;
  sampleTime: number;
  family: "travel" | "lateral" | "turn" | "stop";
  rootDistanceCurve: readonly number[];
  contactSchedule: {
    left: readonly number[];
    right: readonly number[];
  };
  targetFacing: number;
  terminalFoot?: "left" | "right";
}
```

Inertialization may remove the small pose delta after selection. It cannot
create braking, foot placement, lateral clearance, or weight transfer missing
from the candidate data.
