# Beat-Authored Gait Timing Experiment

## Status

Proposed. This document defines one Walk Lab experiment and its acceptance
gate. It does not authorize Stage persistence, footprint editing, or a second
locomotion runtime.

## Outcome

A host supplies a straight destination, an exact number of footfalls, and the
musical beats on which those footfalls must plant. The existing locomotion
animator follows that schedule, the existing destination planner reaches the
mark on the final requested footfall, and the existing terminal controller
settles without inventing another step.

The experiment answers one question before footprint targets are introduced:
can the current animator obey an external score clock without skating, arriving
late, or changing its result with frame rate?

## Why timing comes first

The current gait clock advances from `delta * cadence`. That is suitable when
the animator owns tempo. It cannot guarantee a plant on a musical event because
a second, score-owned clock can drift from it.

Authored foot poses do not solve that disagreement. A perfectly chosen landing
position is still wrong if the animation reaches it between counts. The score
clock must become the authoritative sampling input before the system accepts
lead-foot or stance targets it cannot time faithfully.

## Ownership

The experiment extends the owners already in production:

1. The Stage or Walk Lab host owns musical time and compiles its tempo map into
   resolved seconds.
2. `destination-walk-plan.ts` continues to own root distance and exact endpoint
   construction.
3. `LocomotionAnimator` continues to own gait phase, pose playback, contacts,
   and the terminal transition. In scheduled mode it samples the external plan
   instead of integrating cadence from frame deltas.
4. `FootPlanter` remains a late contact correction layer. It receives the same
   animator-owned contacts and does not decide when a footfall occurs.

No Stage-only gait clock, step planner, terminal controller, or planter is
introduced.

## Resolved runtime contract

Musical beats remain in the plan for diagnostics and round-trip proof. Runtime
sampling uses seconds so tempo changes are compiled once by the score owner
rather than reinterpreted inside the animator.

```ts
interface GaitTimingEvent {
  /** One-based authored footfall number. */
  step: number;
  /** Source count in the music timeline. */
  plantBeat: number;
  /** `plantBeat` resolved through the host's tempo map. */
  plantTimeSeconds: number;
}

interface GaitTimingPlan {
  id: string;
  /** The score position where gait step zero begins. */
  departureBeat: number;
  departureTimeSeconds: number;
  footfalls: readonly GaitTimingEvent[];
  /** Stable two-foot settlement; never earlier than the last plant. */
  settledBeat: number;
  settledTimeSeconds: number;
}

interface GaitTimingSample {
  step: number;
  cadence: number;
  nextFootfall: number | null;
  arrived: boolean;
  settled: boolean;
}
```

The host supplies the current resolved score time every frame. A pure sampler
maps the interval between adjacent footfall events to the existing monotonic
gait-step coordinate. Integer coordinates remain the contact boundaries. Local
cadence is the inverse duration of the current footfall interval, not another
authored control.

This is a resolved plan, not duplicated intent. Beats are provenance; seconds
are the tempo-map result. If the tempo map changes, the host recompiles the
whole immutable plan under a new identity.

## Validation

A plan is invalid when:

- it has no footfalls;
- footfall steps are not exactly `1..N`;
- beat or second values are non-finite or fail to increase strictly;
- departure occurs after the first footfall;
- settlement occurs before the last footfall;
- its footfall count differs from the destination plan;
- any interval implies cadence outside the experiment's declared rig envelope;
  or
- its identity does not match the armed destination and terminal plans.

The first experiment reports an infeasible schedule. It does not silently move
a beat, drop a footfall, stretch the transition, or synthesize a shuffle.

## Terminal transition

The existing terminal controller remains the owner of the final two steps. In
scheduled mode its braking start, terminal plant, and settlement are sampled
from the final timing events instead of a scalar cadence. The authored stop
asset still supplies its root-distance curve and contact schedule.

`TerminalStepPlan.targetFacing` remains outside this experiment because the
current runtime does not execute it. Adding timing must not make that field look
more capable than it is.

## Walk Lab experiment

The lab adds one timing mode to Exact mark:

- fixed tempo choices of 90, 120, and 150 BPM;
- an editable departure count and exactly `N` plant counts;
- one deliberately non-uniform schedule with a held interval;
- the existing destination and exact-step controls;
- an overlay comparing requested plant times with animator contact crossings;
  and
- separate walking, terminal, and settlement verdicts.

The initial schedule uses the current canonical alternating gait and derives
the terminal foot from parity. It does not claim arbitrary lead-foot support.

## Acceptance

Automated proof:

- each authored footfall maps to the corresponding integer gait step;
- sampling is identical for 30, 60, 120, and 144 Hz frame partitions;
- a dropped or delayed frame does not permanently shift later footfalls;
- cadence is derived from adjacent event times and never integrated as a
  competing clock;
- exact root progress still lands on the destination at step `N`;
- even and odd step counts arm the correct existing terminal-foot asset;
- stale timing-plan identities cannot drive a new destination plan; and
- invalid or anatomically unavailable schedules are rejected explicitly.

Live proof on the shipping rigs:

- every requested contact crossing occurs no later than one rendered frame
  after its authored plant time;
- the final root endpoint error remains zero without a snap;
- no extra footfall appears between the last plant and settlement;
- contact slip remains under 2 cm per step;
- joint teleports and knee twitches remain zero;
- playback reaches the same result after a simulated 100 ms frame stall; and
- the terminal arrival report remains inside its current slip, heel-lift,
  acceleration, and knee-jerk thresholds.

The experiment is not accepted merely because its counters line up. The live
browser pass must show believable weight transfer and no visible catch-up or
slow-motion pulse around an authored beat.

## Experiment matrix

| Dimension | Cases |
| --- | --- |
| Footfalls | 4, 8, and 12 |
| Tempo | 90, 120, and 150 BPM |
| Schedule | Even spacing and one held interval |
| Terminal parity | Left and right terminal foot |
| Frame delivery | 30, 60, 120, 144 Hz, plus one 100 ms stall |
| Rig | Remy, shortest shipped rig, tallest shipped rig |
| Planting | On for acceptance; off as a diagnostic comparison only |

## Explicit exclusions

This experiment does not add:

- arbitrary lead-foot selection;
- authored `FootPose` or foot yaw;
- exact two-foot start or goal stances;
- curved paths, sidesteps, crossed steps, or grapevine templates;
- Stage project persistence, migrations, or timeline controls;
- a runtime motion-matching database search; or
- a second root, gait-clock, terminal, or IK owner.

Those capabilities require a follow-on footprint contract after this timing
gate passes. The next proposal may then add `FootprintTarget` and explicit
contact windows to the existing animator/planter path with evidence that the
score clock already holds.

## Proposed implementation scope

After approval, the implementation is limited to:

- a pure timing-plan validator and sampler beside
  `destination-walk-plan.ts`;
- the existing `ILocomotionAnimator` and `LocomotionAnimator` timing seam;
- the existing terminal controller's final-two-event sampling;
- Exact mark controls and timing diagnostics in Walk Lab; and
- focused unit tests plus live in-app-browser verification.

No Stage files are part of this implementation scope.
