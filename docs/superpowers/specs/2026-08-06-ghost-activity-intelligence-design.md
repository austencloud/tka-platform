# The ghost finishes a thought

**Date:** 2026-08-06
**Status:** implemented and verified
**Extends:** `2026-08-04-ghost-mind-design.md`, `2026-08-06-ghost-understanding-design.md`

## The failure

The intention bag makes good individual moves and bad sessions. Every tick asks
the whole bag what to do next, so nothing owns the span between starting an idea
and finishing it. Late in a session, repeatable actions can also outlive every
novel action and take over the show.

Seed 7 crossed 400 real presses after 26 simulated minutes. Step navigation
accounted for 40.4 percent of all presses and 57 percent of the last 103. The
library opened three sequences in sixteen seconds while claiming to inspect
each one properly. The simulator then awarded understanding for an Undo that
did not restore the action before it.

Those are planning failures. Appeal tuning cannot give an action a beginning,
middle, and end.

## Reuse decision

The 2D fish already separate selection from execution. Personality, mood, and
environment weight the next behavior, then that behavior persists until its
timer or outcome ends it. The 3D fish use the same split in a smaller form:
context selects a state, and a state timer prevents a new choice every frame.

The Ghost already owns the other half of the needed system: guarded intentions,
seeded utility selection, observable outcomes, and session memory. This work
extends those primitives with persistent activities.

XState 5 was evaluated. It provides typed state machines, actors, guards, and
invoked work. Adopting it here would duplicate the Ghost's existing guards,
executor, seeded selector, and inspectable memory. The missing layer is specific
to the presenter and small enough to remain a pure domain module.

Epic's StateTree is the closest architectural reference. Utility selects a
state, tasks remain active inside it, and transitions happen on completion,
failure, or a monitored interruption. The Ghost will use that shape without
bringing an engine-sized state-machine runtime into the browser.

## The activity layer

An activity is a short plan with a visible purpose:

```text
utility selector
  -> activity
      -> guarded intention
      -> guarded intention
      -> outcome or recovery
  -> next activity
```

The first activity set is:

- `compose`: choose a start, add a run of steps, then play it.
- `generate`: enter Generate, adjust at most one setting, generate once, watch,
  and return to Construct.
- `inspect`: play, move through the sequence in one direction, change one view,
  and optionally inspect one step.
- `finish`: open sequence actions, extend or transform once, then watch.
- `style`: apply one effect, tune or reject it, then watch the result.
- `change-prop`: open the prop picker, choose one prop, then watch.
- `practice`: enter camera practice, let it run, then leave.
- `viewer`: open the viewer, play, watch, then close it.
- `browse`: enter the library, filter, inspect the result set, open one item,
  clear the filter, then leave.
- `visit`: enter one useful module, interact with it, then leave.
- `reset`: clear only after the current result has had time to exist.

Activities are selected with seeded utility and activity-level novelty. An
active activity does not compete with the entire bag every tick. Its next
satisfiable task runs. Optional tasks may be skipped. A required task that is no
longer possible aborts the activity and returns control to the selector.

`dismiss-blocker` and `escape-room` are interrupts. Safety remains more
important than commitment.

## Transport is an inspection, not a slot machine

One inspection chooses a direction and keeps it for the whole beat. Restart is
a special case: restart once, then move forward. A single beat never mixes
Restart, Previous, and Next at random.

Step inspection no longer bypasses novelty forever. Activity commitment already
provides the repetition needed inside the beat. Activity-level novelty and a
cooldown decide when another inspection is earned.

## Honest outcomes

The simulator's contract is strengthened from "the button was pressed" to "the
state changed the way that button changes it."

- Transport tracks the current step and exposes a real control configuration.
- View toggles and tempo have state.
- Playback expiry updates the DOM before the next sense.
- Sequence mutations push snapshots onto an Undo history.
- Undo restores the exact preceding sequence snapshot.
- Clear, Generate, and library loads replace the sequence word instead of
  carrying transformation marks from an earlier sequence.
- Session records include the presses caused by each decision.

Learning still requires a measured before and after. A reaction may only claim
reversibility when Undo restored a real difference.

## Behavioral contracts

A 400-press session must satisfy all of these:

- No failed performs.
- Step navigation stays below one fifth of presses and does not grow into a
  late-session majority.
- Every step-through beat uses one direction. Restart may only be followed by
  forward movement.
- Module navigation does not occur on consecutive decisions.
- A library visit may open one item, and filtering is followed by inspection
  before departure.
- Undo restores the mutation immediately before it.
- Clears do not occur within one minute of Extend, Generate, or another payoff.
- The run still reaches Generate, sequence actions, Browse, effects, props, and
  playback across a seeded fleet.

The single canonical transcript catches order regressions. The fleet catches
seed fitting. Neither is allowed to substitute for the other.

## Scope

The activity model belongs under `src/lib/shared/attract/domain/`. The mind owns
activity lifecycle because it already owns sensing, selection, performance, and
memory. Existing intentions remain the action leaves.

The simulator changes only under `tests/unit/attract/sim/`. It must follow the
real annotations and control semantics closely enough for decision-order claims.
It is still not a visual oracle.

No new dependency, service, UI component, route, or persistence layer is added.
