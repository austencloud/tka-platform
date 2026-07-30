# Poi Reversal Teacher

**Date:** 2026-07-30  
**Status:** Approved by the current request for implementation  
**Scope:** One-hand reversal trajectories, one candidate at a time, with
step-local corrective feedback

## Purpose

Build the missing reversal dataset without presenting an untested rule as poi
canon.

The existing 784-cell matrix settles steady-state flowers. It says nothing
about reversals or transitions. A gallery labeled "poi legal" would therefore
claim more than the data supports. This surface shows one unlabeled trajectory,
collects Austen's verdict, and saves the exact candidate beside the correction.

## Evidence behind the design

- `docs/reference/poi-legality.md` reproduces the steady-state result at 784
  agreements and 0 disagreements.
- The current curation surface at `src/routes/test/poi-matrix/` proves the
  working-tree JSON workflow: reactive edits, local backup, and a dev-only save
  endpoint.
- The QFT renderer already draws a hand, tether, head, trail, compass, direction,
  and active step from a continuous cursor.
- The current QFT model has one scalar prop rate plus a separate pendulum path.
  It cannot express an arbitrary rate change inside the eight-step cycle.
- Recent active-learning research supports collecting corrective feedback, not
  only a class label. Research on human label variation also supports retaining
  repeated and unsure judgments as data.

Poi and pendulum are absent from the Flow Arts MCP glossary. Poi judgments on
this page come from Austen. The page never promotes its selector or a derived
hypothesis to canon.

## The judged unit

One candidate is one hand moving through one closed eight-step trajectory:

```ts
{
  radius: number;
  handDirection: 1 | -1;
  propRate: readonly[
    (number, number, number, number, number, number, number, number)
  ];
  propPhase: number;
}
```

`propRate` is relative to the hand direction. The drawn rate is
`handDirection * propRate[step]`.

The first experiment keeps the rate magnitude at one and gives every candidate
two reversals. It varies:

- radius: `0`, `0.5`, `1`
- hand direction: clockwise or counterclockwise
- first reversal: every hand position on a moving hand
- prop bearing at that reversal: all eight compass positions

This produces 260 controlled candidates. A stationary hand has no meaningful
hand direction or reversal hand position, so duplicate stationary animations
collapse to the four possible prop axes. The known pendulum and extendulum
examples are early calibration candidates. They are still shown for review so
the dataset confirms that the rendered interpretation matches Austen's move.

One hand comes first because the existing steady-state result is per-hand and a
single trajectory makes a step-local failure attributable. Pair and
move-to-move transition experiments follow only after the one-hand reversal
language has evidence.

## Review contract

The categorical question is: **Can this path be performed continuously with
poi at some workable speed?** Playback speed is only a reading control.
Minimum-speed physics is a separate experiment, so a slow preview cannot turn a
workable path into an illegal label.

Each observation stores:

```ts
{
  id: string;
  candidate: PoiReversalCandidate;
  verdict: "legal" | "illegal" | "unsure";
  firstIllegalStep: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | null;
  reason: string;
}
```

Rules:

- Legal requires no failure step.
- Illegal requires a first illegal step and a written reason.
- Unsure accepts an optional note.
- Observations append. A repeated review does not overwrite the earlier one.
- Candidate snapshots live in the file. Generator changes cannot silently
  reinterpret old labels.

The page keeps unsaved observations in localStorage and writes the complete
versioned file through a dev-only endpoint. A failed save leaves the dirty
observations intact and reports the error on the page.

## Candidate selection

The selector is transparent and deterministic.

1. Show the pendulum and extendulum calibration candidates first.
2. Until both legal and illegal examples exist, choose the candidate farthest
   from reviewed geometry.
3. After both classes exist, prefer candidates near the observed boundary while
   still rewarding untested geometry.
4. Every tenth observation repeats a previously reviewed candidate. Repeats
   remain separate observations.

Distance uses radius, hand direction, reversal hand positions, and reversal prop
positions. The selector does not predict or display a legal label.

The page says why the candidate was selected:

- calibration example
- untested geometry
- boundary check
- repeat check

## Surface

Route: `src/routes/test/poi-reversals/+page.svelte`

The surface has one subject:

- large QFT stage with the active trajectory
- play, previous step, and next step controls
- an eight-cell rate strip that follows the playhead
- candidate facts and progress
- Legal, Illegal, and Unsure actions
- when Illegal is selected, first-failing-step selection and a required reason
- Save button with dirty count and a reserved status slot

Clicking a step pauses and seeks. While Illegal is selected, clicking a step
also marks it as the first failure. Keyboard controls mirror the visible
controls and do nothing while a text field has focus.

Animation stops under reduced-motion preference. Manual stepping remains
available.

## Architecture and reuse

### Extend the QFT renderer

Add `src/lib/shared/notation/qft/qft-trajectory.ts` for prefix-sum integration,
poses, trails, increments, and reversal locations.

Extend:

- `src/lib/shared/notation/qft/components/QftStage.svelte`
- `src/lib/shared/notation/qft/components/QftFigure.svelte`

The existing knob and pendulum paths remain byte-compatible. A trajectory is a
third input form. This gives the reversal lab the established QFT drawing
without duplicating SVG or animation math.

### Poi-specific experiment and state

Add:

- `src/lib/features/levels/poi-lab/domain/poi-reversal-candidates.ts`
- `src/lib/features/levels/poi-lab/state/poi-reversal-review-state.svelte.ts`
- `src/lib/features/levels/poi-lab/data/poi-reversal-observations.json`
- `src/routes/test/poi-reversals/save/+server.ts`

Candidate generation, file validation, distance, and selection are pure
functions. Reactive draft and dirty state live in a factory. The save function
is injected by the route.

### Existing primitives

- `QftStage` and `QftFigure` for the animation
- `HorizontalTransportRow` for playback controls
- the matrix curation persistence pattern for working-tree data
- the semantic verdict flow established by `PhaseVerificationPanel`

`StepStrip` renders TKA pictographs, not QFT rate increments, so it is not a
match. `FeedbackTextarea` owns voice, image, and minimum-length behavior that
does not belong in a legality correction. The page uses a labeled native
textarea inside its review form.

## Tests

Focused tests cover silent failures:

- prefix-sum interpolation before and after a reversal
- closed-cycle position continuity
- increment direction on both sides of a reversal
- exact reversal-step and bearing derivation
- 260 unique candidates with stable IDs and no duplicate stationary animations
- calibration candidates match the worked pendulum and extendulum data
- deterministic next-candidate selection
- append-only observations and file round-trip
- illegal observations cannot be recorded without a step and reason

The page itself is verified in Chrome at the required desktop, 4K, tablet, and
phone viewports. Runtime checks confirm no overflow and that playhead, seeking,
verdict entry, backup, and save behave on the rendered page.

## Not in this experiment

- claiming a complete poi legality algorithm
- physics simulation or minimum-tempo calculation
- two-hand VTG relationships
- transitions between separate TKA pictographs
- production composer filtering
- changing the public Poi Lab status
- merging the three public QFT modes
