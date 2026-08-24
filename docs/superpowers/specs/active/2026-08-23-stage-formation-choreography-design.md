# Stage Formation Choreography — Design

**Date:** 2026-08-23
**Status:** Approved (Austen approved Approach A and the four-section design in conversation, 2026-08-23)
**Supersedes:** the per-performer mark-chain movement model in
`2026-08-20-stage-performance-runtime-design.md` (the runtime's facing/walk-style
semantics, playhead clock, and rig ownership all carry forward unchanged).
**Related research:** `docs/superpowers/specs/backlog/2026-05-25-stage-locomotion-design.md`
(historical FormationKeyframe model; superseded but directionally aligned).

## Why

The Stage editor's mental model is marching band drill: formations are the unit
you move between. Poker chips on the ground — each performer walks to their spot
in a specific number of counts, usually 8 or 16, and the whole cast arrives
together. Austen's canonical example: a triangle with one performer downstage
center; in the final 16 counts of a 64-step sequence, that performer steps
backward while the two back performers step forward — a reverse triangle.

Today's data model cannot say that. Each `Performer` carries `marks: Mark[]`, a
chain of relative walk-durations, and a "formation" is a coincidence of N
separate chains staying in sync. If one performer's durations total 40 beats and
the rest total 48, the triangle silently stops being a triangle — nothing in the
model knows a triangle was intended. The existing "apply preset" flow
(`stage-choreography-state.svelte.ts:380-431`) spends ~50 lines of splice
arithmetic faking a group keyframe on per-performer chains, which is the
compile-down trap this design removes.

Decision (Approach A of three considered): **formations become the authoritative
data model.** Per-performer mark chains retire. Formation-as-authoring-layer
(compile to marks) was rejected as a two-sources-of-truth trap; coexisting
tracks were rejected as paying for two models forever.

## Data model

`Performer.marks` is removed. `StageChoreography` gains one ordered list:

```ts
interface StageChoreography {
  // ...existing fields unchanged (bpm, stage size, performers, clips)...
  formations: Formation[]; // sorted by atBeat; formations[0].atBeat === 0
}

interface Formation {
  id: string;
  label?: string;                // "Opening", "Set 2" — optional
  atBeat: number;                // absolute beat the cast must be IN PLACE
  transitionBeats: number;       // counts of walking that END at atBeat (0 = opening/snap)
  spots: Record<string, FormationSpot>; // keyed by performer id
  presetId?: FormationPresetId;  // provenance; flips to "custom" once a spot is dragged
}

interface FormationSpot {
  x: number;                     // stage-space, same convention as old Mark
  z: number;
  facingAngle?: number;          // undefined = walk-style default
  walkStyle: WalkStyle;          // "crab" | "direct", per performer per transition
  easing: EasingType;
}
```

### Timing semantics (arrive-by)

- A formation is **held** from its `atBeat` until the next formation's walk
  begins at `next.atBeat - next.transitionBeats`.
- The **walk** into formation `i` occupies
  `[atBeat - transitionBeats, atBeat]`, interpolating each performer from their
  spot in formation `i-1` to their spot in formation `i`, with that spot's
  easing. Straight-line paths in this slice.
- The triangle example is two rows of data: opening triangle at
  `atBeat: 0`, reverse triangle at `atBeat: 64, transitionBeats: 16`.

### Invariants (enforced by state mutations, clamped on edit)

1. `formations` stays sorted by `atBeat`; no two formations share an `atBeat`.
2. `formations[0]` has `atBeat: 0, transitionBeats: 0` (the opening set).
3. `transitionBeats <= atBeat - previous.atBeat` — a walk cannot start before
   the previous set is reached.
4. Every formation has a spot for every performer; adding a performer backfills
   spots into all formations (at that performer's default preset position);
   removing a performer strips their spots.
5. `atBeat` and `transitionBeats` are whole beats.

### Defaults

New formation: `transitionBeats: 8` (16 one tap away). Spots seed from either
the current sampled cast positions ("keyframe what I see") or a preset from the
existing 17-generator library in `formation-presets.ts` (which is reused
unchanged — it already produces per-performer positions from
preset × count × stage size).

Everything stays in beats, so a BPM change re-times the whole drill to any song.
No audio subsystem is added in this slice; the existing beat clock is the
music-awareness.

## Runtime

`stage-performance-sampler.ts` is rewritten to consume formations:

- `samplePerformerPerformance(performer, choreography, beat)` becomes
  `sampleFormationPerformance(choreography, performerId, beat)` (or keeps its
  name with a changed signature — implementer's choice, but ALL callers are
  inside `src/lib/features/stage/`, verified by grep 2026-08-23).
- Segment lookup: binary/linear scan of `formations` for the hold-or-walk
  segment containing `beat`; interpolate with `applyStageEasing`; derive
  `speedMetersPerSecond` with the easing derivative exactly as today.
- **The `StagePerformanceFrame` output contract does not change** (position,
  `bodyFacing`, `travelDirection`, `moveDirection`, speed, `isMoving`,
  `transitionProgress`). `activeMarkIndex` is renamed `activeFormationIndex`.
  The crab/direct facing rules (`segmentFacing`), stage→world mapping, and
  easing math carry over verbatim.
- Downstream consumers (StageViewer rig driving, locomotion/motion-matching
  subsystem, dodge planner, video export) are untouched: they read frames.
- `formation-interpolator.ts` helpers (`computeMarkDistance`,
  `computeMarkSpeed`) are reworked in formation terms or folded into the
  sampler; `MarkProperties.svelte` becomes the per-spot/per-transition
  properties panel (walk style, easing, facing — same controls, new subject).

### Legacy migration

A pure converter `marksToFormations(performers): Formation[]` runs in the
choreography loader when a stored project has `marks` and no `formations`:

- Collect the union of arrival beats across all performers' chains.
- Create a formation at each arrival beat; each performer's spot = their old
  chain sampled at that beat (using the existing sampler math, kept private to
  the converter).
- `transitionBeats` = the gap since the previous arrival beat, clamped by
  invariant 3; walkStyle/easing taken from the mark active at that arrival.
- Best-effort by design: chains that were deliberately desynchronized flatten
  into more formations. Stage projects are young; this is acceptable and is
  covered by a unit test with a mixed-duration fixture.

## Editing

### Formation track (StageTimeline)

One new row above the performer lanes:

- Each set renders as a **block** at its anchor spanning its hold; the walk in
  renders as a visually distinct **ramp** spanning `transitionBeats` and ending
  at the anchor.
- Drag a block → move `atBeat` (whole-beat snap, invariants clamp).
- Drag the ramp's leading edge → retime `transitionBeats`.
- Click → select the formation (selection lives in `stage-edit-mode`); the
  top-down overlay switches to drill-chart editing for it.
- An add control at the playhead creates a formation there (seeded per
  Defaults). Delete/Backspace removes the selected formation (never the
  opening set).
- Built from the timeline's existing patterns and shared primitives — no new
  hand-rolled selector chrome; transition-count quick-pick (8/16) uses
  `SegmentedControl` or `FilterChipBase` per `chip-primitives.md` routing.

### Drill-chart overlay (FormationOverlay)

When a formation is selected:

- Its spots render as draggable chips (poker chips) in performer colors.
- The previous formation's spots render ghosted, with travel arrows previous →
  selected, so the move reads like a drill chart.
- Dragging a spot sets `presetId` to `"custom"`.
- The preset picker in `StageSidebar` now writes/reseeds the **selected
  formation's spots** instead of splicing marks.

### Undo/redo

All formation mutations go through the existing history in
`stage-choreography-state.svelte.ts` (same snapshot mechanism the mark
mutations use today).

## Out of scope (named, not forgotten)

- Collision/dodge wiring during transitions (the `locomotion/dodge/` planner
  exists; paths are derivable from this model later).
- Curved paths; deterministic foot phase; foot-planting quality — owned by
  `@austencloud/scene-3d` `PerformerRig` per the runtime spec's ownership table.
- The Blossom feet-below-floorboards bug (assigned to another agent).
- Audio import / beat detection.
- Per-performer "released from formation" free paths (the escape hatch is
  designed-for — a future `released: boolean` span on a spot — but not built in
  this slice).

## Verification contract

- Unit: `tests/unit/stage/stage-performance-sampler.test.ts` rewritten against
  formations (hold/walk boundaries, easing speed, crab vs direct facing,
  before-first/after-last clamps); new converter test with a desynchronized
  fixture; `stage-choreography-state.test.ts` extended for formation CRUD +
  invariant clamping; `formation-interpolator.test.ts` updated or retired with
  its module.
- Contract: `stage-module-contract.test.ts` stays green.
- End-to-end proof: the triangle → reverse-triangle move authored in the
  editor and played back — the downstage-center performer walks upstage while
  the two back performers walk downstage over the final 16 counts, sequences
  still playing. Screenshot/recording evidence per
  `visual-verification-mandatory.md` (all required viewports for the new
  timeline row; visual verification is done by the main session, never
  delegated).
- `npm run check` green; scoped commits per `commit-only-your-own-changes.md`.

## Implementation phases (each independently verifiable)

1. **Domain:** `Formation`/`FormationSpot` types; sampler rewrite; legacy
   converter; unit tests. No UI. (`stage-types.ts`,
   `stage-performance-sampler.ts`, new `formation-migration.ts`, tests.)
2. **State:** formation CRUD + invariants + selection in
   `stage-choreography-state.svelte.ts` / `stage-edit-mode.svelte.ts`;
   preset-apply rewired; mark CRUD removed; tests.
3. **Timeline UI:** formation track row in `StageTimeline.svelte` (blocks,
   ramps, drag/retime/select/add/delete).
4. **Overlay UI:** drill-chart mode in `FormationOverlay.svelte` (ghosts,
   arrows, spot drag); `MarkProperties.svelte` → spot/transition properties;
   `StageSidebar.svelte` preset picker rewire.
5. **Proof pass:** author the reverse-triangle demo, full visual verification
   sweep, evidence, ship.
