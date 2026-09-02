# Film Director Round 2: Adversarial Gap Ledger

> **For agentic workers:** one executor per wave, working in
> `E:/worktrees/tka-platform/director-round2`. Read this file at the start of
> the wave. Tick `- [x]` with evidence when a gap lands. Steps use checkbox
> syntax for tracking.

**Goal:** every parameter Austen might dictate that the runtime can already
honour becomes speakable in the film language, and every one it cannot honour
becomes a named rejection in the capability matrix.

**Source:** `docs/superpowers/specs/active/2026-09-02-film-director-adversarial-corpus.md`
(40 dictated requests, verdicts FULL 2 / PARTIAL 29 / NONE 9, gap census at the
end). Round 1 ledger and conventions:
`docs/superpowers/plans/2026-08-30-film-director-gap-campaign.md`.

**Architecture:** the language lives in `src/routes/test/film-director/_lib/`.
Schema (`film-director-schema.ts`, zod v5 grammar) validates; `resolve-film-director-spec.ts`
turns a film into resolved scenes; `camera-language.ts` compiles framing +
moves to keyframes; `sample-film-director.ts` samples a film time into a frame;
`director-viewer-adapter.ts` writes the frame into the 3D viewer. Tests live
in `tests/unit/film-director/` and run with
`node node_modules/vitest/vitest.mjs run --config tests/config/vitest.config.ts tests/unit/film-director`
(719 passing at round-2 start). `docs/reference/film-director-capability-matrix.md`
is the speakable-surface source of truth and MUST be updated in the same wave
as the grammar. `_films/proving-grounds.ts` (`?film=proving`) gets one scene
per gap as the regression fixture; `tests/unit/film-director/film-library.test.ts`
covers the library.

**Standing rules for every wave**

- Schema version stays 5 unless a wave changes the meaning of an existing
  field; adding fields is additive. Keep the "version is provenance, not a
  gate" comment true.
- Every new field gets: a zod rule with a rejection message that names the
  scene/performer; a resolver; a runtime write if one is needed; unit tests
  (schema accept + reject, resolver behaviour, sampler behaviour); a matrix
  row; a Proving Grounds scene; a snapshot update if keyframes change.
- Never invent runtime capability. If a setter does not exist, the gap
  becomes a matrix rejection with the file that proves it.
- Commit with explicit pathspecs only (`git add <paths>`, `git commit -- <paths>`).
  Message ends with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
  Never push.
- No em dashes anywhere in prose, comments, or copy.

---

## Wave A: camera (one executor)

### Gap 10: concurrent camera moves (dolly zoom) — R08, R09, R25, R27, R28, R32

- [x] `cameraMoveSchema` gains `with: cameraMoveSchema[]` (max 4). Members
      share the parent's time window and easing unless they state their own
      easing. Rejections: `with` inside a `with` member; `hold` as a member or
      as a parent of `with`; a member stating `durationSeconds`/`durationBeats`
      ("members share the parent's window").
      Evidence: Done: `cameraMoveMemberSchema` + `with` (1-4) in `film-director-schema.ts`; MOVE_GROUP_NESTED / MOVE_GROUP_HOLD / MOVE_GROUP_MEMBER_DURATION cover the three rejections.
- [x] `compileCameraMoves` compiles a move group as one window: sample the
      window at N segments (N = max over members of their segment count; orbit
      uses `ORBIT_SEGMENT_DEG`, everything else 1, minimum 2 so eased members
      still read), and at each sample apply every member's partial delta from
      the group's start state in listed order. Position, target, fov and roll
      all composable. Zoom range check applies to the end state.
      Evidence: Done: the group branch of `compileCameraMoves` composes `moveGroupDelta` per member from the group's start state; `moveGroupSegments` takes the max, floor 2, and the end-state fov is range checked.
- [x] Dolly zoom as one statement: a `zoom` member inside a `push-in` or
      `pull-back` may state `amount: { match: "subject-size" }`; the compiler
      solves fov so `tan(fov/2) * distance` stays constant across the window
      (clamped to 20..100 with the existing rejection if the end fov leaves the
      range). `match` on any other zoom is rejected by name.
      Evidence: Done: `isMatchZoom` + the zoom branch of `moveGroupDelta` solve fov from the running distance; MATCH_NEEDS_A_TRAVEL / MATCH_IS_A_ZOOM / MATCH_HAS_NO_DIRECTION reject it anywhere else.
- [x] Tests: push-in + zoom-out keep subject size within 1% at every sampled
      keyframe; truck + crane produce a diagonal; orbit + zoom produce N orbit
      segments each with interpolated fov; rejections above.
      Evidence: Done: four tests in `camera-language.test.ts` (subject size within 1%, truck+crane diagonal, orbit+zoom keeps 3 segments with a falling fov, out-of-range group) plus eight schema rejection tests.
- [x] Proving Grounds scene `dolly-zoom` (solo, medium, 6 s push-in with
      match-size zoom, then hold).
      Evidence: Done: proving-grounds scene 11 `dolly-zoom`, 8 s, 1.2 m push (2 m would need a 114-degree lens), verified by `film-library.test.ts`.

### Gap 11: handheld — R28

- [x] `cameraSchema.handheld: "subtle" | "steady" | "rough" | { meters: number (0..0.3), degrees: number (0..5) }`
      allowed with framing grammar, shots, presets and keyframes alike (it is a
      modifier on the sampled frame, not a framing).
      Evidence: Done: `cameraSchema.handheld` sits beside every camera form; `resolveHandheld` runs in all four return paths of `resolveDirectorCameraTrack`.
- [x] Resolved scene camera carries `handheld: { meters, degrees, seed } | null`.
      Seed derives from the film seed + scene id through `directive-random.ts`
      (reuse `createAxisStream`-style hashing; do not add Math.random).
      Evidence: Done, with one deviation: resolved `handheld` is OPTIONAL AND ABSENT rather than `| null`, following the `tracking` precedent, so untouched films stay byte-identical. Seed from the new `axisSeedValue` export in `directive-random.ts`.
- [x] `sampleFilmDirector` applies a deterministic smooth noise (sum of 3
      incommensurate sines per axis, phases from the seed) to position (meters
      envelope) and to target (degrees envelope, converted at the current
      distance) AFTER tracking. Zero when absent. Presets: subtle 0.02 m / 0.4
      deg, steady 0.05 m / 1 deg, rough 0.12 m / 2.5 deg.
      Evidence: Done: `applyHandheld` in `sample-film-director.ts`, three sines per axis at 0.29/0.71/1.63 Hz, wrapped around `applyCameraTracking`. Presets exactly as stated.
- [x] Tests: deterministic across calls; bounded by the envelope; absent means
      identical frames to today; works on a shots camera.
      Evidence: Done: four tests in `sample-film-director.test.ts` covering determinism, envelope bound, byte-identical when absent, and a shots camera.
- [x] Proving Grounds scene `handheld` (line of 3, wide, `handheld: "steady"`).
      Evidence: Done: proving-grounds scene 12 `handheld`, 7 s, line of 3, wide, `handheld: "steady"`.

### Gap 28: pan to a performer — R27

- [x] `pan` accepts `to: { kind: "performer", performerId }` (or a `point`)
      instead of `direction` + `amount`; rejection when both are given. The
      compiler computes the signed degrees from the current aim to that
      subject's resolved position (opening mark; live tracking is out of scope).
      Evidence: Done: `cameraPanDestinationSchema` plus `panDegrees`/`resolvePanDestination`; PAN_TO_OR_ANGLE and TO_IS_A_PAN reject the contradictions.
- [x] Tests: two performers at x = -2.5 and 2.5, camera front; pan `to` the
      second ends aimed within 0.01 m of their mark.
      Evidence: Done: three tests in `camera-language.test.ts` (performer, point, missing performer named) assert the final aim angle to 1e-6.
- [x] Proving Grounds scene `whip-pans` (two performers, 0.3 s pans to each).
      Evidence: Done: proving-grounds scene 13 `whip-pans`, 8 s, him/her at x -2.5 and 2.5, two 0.3 s linear pans; aim verified at 2.5 s, 5 s and 7.9 s.

### Wave A close

- [x] Matrix rows for `with`, `match: "subject-size"`, `handheld`, `pan.to`;
      "Spoken but not real" rows for motion blur and depth of field
      (post-processing stack has neither, cite the directory).
      Evidence: Done: four rows added beside the camera framing grammar row, plus motion blur and depth of field bullets citing `src/lib/shared/3d/effects/post-processing/`.
- [x] Snapshot update (`-u`) reviewed: only new scenes and no changed values
      for untouched films.
      Evidence: Done: `git diff -U0` shows three hunks, all inside the Proving Grounds block (839 insertions, 2 deletions: the brief and the film duration).
- [x] Full film-director suite green; `npm run check:fast` clean for the
      touched files. Commit with pathspecs.
      Evidence: Done: 743 tests pass in `tests/unit/film-director` (719 before); `npx tsc --noEmit` reports nothing under film-director. Commit a079e81f3d.

---

## Wave B: film structure (one executor)

### Gap 13: scene inheritance — R16, R17, R20, R21, R22, R24, R30, R32

- [x] `sceneSchema.extends: string` names an EARLIER scene id in the same
      film. The raw input of the child is deep-merged over the raw input of the
      parent before resolution: plain objects merge key by key, arrays replace
      wholesale, `null` on the child deletes the parent's key. `id` is always
      the child's; `title` becomes optional when `extends` is present and
      defaults to the parent's title. Chains are allowed (parent may itself
      extend). Rejections name the scene: unknown parent, forward or self
      reference.
- [x] Implement in `resolveFilmDirectorSpec` before `resolveScene` (or in a
      new `expand-scene-inheritance.ts`), on the validated input; the resolved
      scene records `extends: parentId | null`.
- [x] Tests: callback scene equals its parent except camera; null deletes;
      arrays replace; error cases.

### Gap 14: seed sharing — R21

- [x] `sceneSchema.seedAs: string` (an earlier scene id). Every axis stream
      for the scene uses the named scene's id as its scene key, so a quoted
      scene with `pick` draws the same values. Rejections as for `extends`.
      `extends` does NOT imply `seedAs`; document why (a callback usually
      wants the same draws, so the matrix example shows both).
- [x] Tests: two scenes with `pick: "any"` character and `seedAs` resolve the
      same cast; without it they differ for at least one axis.

### Gap 21: a cast of zero — R23

- [x] `castSchema.count` min 0 and `performanceSchema.performers` min 0 (an
      explicit empty array). `resolveScene` produces an empty cast; group
      framing targets the stage origin at the group's default height; stage
      extent is the origin. Adapter with zero directed performers idles the
      whole pool. The default when nothing is stated stays one performer.
- [x] Tests: resolve, sample and (contract-level) adapter path with zero
      performers; camera keyframes finite.

### Gap 22: bars — R18, R19

- [x] `performanceSchema.meter: { beatsPerBar: int 2..12 }` (default 4).
      Everywhere `durationBeats`/`atBeats` is accepted, `durationBars`/`atBars`
      is accepted too and converts through the meter in
      `convertSceneBeatTimes`; the at-most-one-time-unit refine covers three
      units. Error text follows the existing beats wording.
- [x] Tests: 3/4 at 90 bpm, 8 bars = 16 s; mixing bars and beats rejected.

### Wave B close

- [x] Proving Grounds scenes: `callback` (extends + seedAs an earlier scene,
      camera from behind), `empty-stage` (count 0, 3 s), `waltz` (3/4, 4 bars).
- [x] Matrix rows; rejection rows for "environment change within a scene" and
      "more than 24 scenes / 60 s scene" (already caps; state them).
- [x] Suite green, snapshot reviewed, pathspec commit.

---

## Wave C: timing and per-step scalars (one executor)

### Gap 15: named cues — R10, R14, R19, R38, R40

- [x] `sceneSchema.cues: Record<name, { atSeconds } | { atBeats } | { atBars }>`
      (max 16 names, names `^[a-z][a-z0-9-]*$`). A cue is a moment in scene
      time.
- [x] Anywhere a `step` integer is spoken (`stepPlanes`, `stepEffects`,
      `stepEfforts`, `stepStaffLengths`, `holds.fromStep`) a cue name is
      accepted; it must land on an integer step at the scene bpm (tolerance
      1e-6) or reject naming the cue and the fractional step.
- [x] Camera moves, camera shots, and blocking moves accept `until: cueName`
      as their duration: the window ends at the cue. Rejection when combined
      with a duration unit, or when the cue precedes the window start.
- [x] Camera keyframes accept `at: cueName`.
- [x] Tests: one cue drives a stepEffect, a shot boundary and a blocking stop
      to the same second; rejections.

### Gap 16: phrase continuity — R16, R20, R22, R24

- [x] `performanceSchema.phrase: "restart" | "continue"` (default restart).
      `continue` means the shared step clock starts where the previous scene's
      clock ended (previous `stepOffset + duration * bpm / 60`). Resolved scene
      gets `performance.stepOffset`. `sampleFilmDirector` adds it to
      `sequenceStep`. First scene with `continue` is rejected by name.
- [x] Tests: 8-beat scene followed by a continue scene starts at step 8; a
      bpm change with continue keeps the step continuous.
- [x] Proving Grounds scene pair `tempo-slow` / `tempo-double` (continue).

### Gap 17: staff length over time — R02

- [x] `stepStaffLengths: [{ step | cue, staffLengthCm, ease?: boolean }]` on
      performer and cast defaults (same replace-not-merge rule as stepEffects).
      Between entries the length interpolates linearly from the previous
      entry's step to the entry's step when `ease` is true (default true);
      false steps at the entry.
- [x] Adapter: `applyDirectorStepChanges` writes `setStaffLengthCm` when the
      value changes by 0.5 cm or more (extend `DirectorAppliedStepChange`).
- [x] Tests and Proving Grounds scene `growing-staff` (100 cm to 250 cm over
      the scene).

### Gap 18: blocking timeline — R11, R22

- [x] `performanceSchema.blocking` accepts either the current single object
      or an array of them, each with optional `atSeconds|atBeats|atBars|cue`
      start (default: the end of the previous entry, 0 for the first). Each
      entry names an `endFormation`; performers hold their marks between
      entries. Rejection: overlapping windows, an entry ending after the scene.
- [x] Tests: two-line to circle at halfway; two successive formation changes.
- [x] Proving Grounds scene `two-lines-one-circle`.

### Gap 19: hold at a chosen point in the arc — R32

- [x] `holdSchema.progress: 0..1` (default 0): the held step is pinned at
      that fraction through the step instead of its start.
- [x] Tests on `resolveHeldStep`; matrix row.

### Wave C close

- [x] Matrix rows; rejection row for a bpm curve inside one scene (spell it as
      two scenes with `phrase: "continue"`).
- [x] Suite green, snapshot reviewed, pathspec commit.

---

### Wave C notes (executor, 2026-09-02)

Deviations from the section text above, all deliberate:

- `stepStaffLengths` bounds are 40-300 cm, matching the existing
  `staffLengthCm` field in the same schema. `setStaffLengthCm` in
  `character-instance-state.svelte.ts` clamps nothing, so the grammar's own
  neighbouring field is the only honest bound available.
- `ease` is `"cut" | "linear"` (default `"linear"`) rather than a boolean, so
  the resolved entry says what it does.
- `stepOffset` is scene-scoped, not per performer. Per-performer variation is
  already carried by `beatOffset` and `holds`, and a second per-performer
  offset would double-count it.
- A blocking phase starts with `startSeconds | startStep | startCue` rather
  than `atSeconds|atBeats|atBars|cue`; `startStep` and `startCue` cover counted
  and named starts, and a phase length still takes the beats and bars twins.

Evidence: 793 film-director tests pass (771 before, 22 added in
`tests/unit/film-director/wave-c-timing.test.ts`).
`npx tsc --noEmit -p tsconfig.json` reports nothing under film-director. The
snapshot diff is three hunks, all inside the `"Proving Grounds" (proving)`
block; every other film is byte-identical.

## Wave D: runtime-gated (scope fixed by the 2026-09-02 runtime census)

Census findings (read-only agent, file:line evidence in its report):

- Gaze: `AvatarAnimator.params.headLookAt` exists in the scene package but has
  no writer anywhere in the package or in `src/`; no performer setter.
- Per-hand effect: `EffectOrchestrator3D.svelte` already resolves effects per
  prop and per tip (`resolveEffect(propIndex, tipIndex, tipEffectMap, ...)`
  lines 214-217) and accepts a `tipEffectMap` prop; the gap is only that
  `character-instance-state.svelte.ts` `setEffect` (line 1019) stores one
  effect per performer.
- Postures: the package state machine has IDLE/WALKING/CROUCHING/JUMPING/
  FALLING/LANDING and `LocomotionAnimator.setActiveState` (line 740), but the
  state is re-chosen from movement signals each frame and the tka performer
  layer exposes no trigger. No kneel, sit, lie.
- Lighting: atmosphere looks exist for `ember` only and are read once at
  construction from a dev-only query param (`EmberScene.svelte` 47-59). No
  runtime setter, no fog setter.
- Audio: `SceneAudioPlayer.svelte` picks from a fixed ambience catalog by
  environment; nothing plays an arbitrary URL against a clock.
- Prop build: `setPropBuild(Partial<PropBuild>)` is real
  (`character-instance-state.svelte.ts:1081`) and never called by the
  adapter. Finish (`propFinishState`) is a global singleton in the package,
  not per performer.

Wave D scope (one executor):

- [~] Gap 12: camera subject on a hand or prop tip. Landed: the schema, the
      1.1 m / 1.4 m compile-time aim, and the "prop-builds"/"hand-cam" scenes.
      Stopped on live re-aim, per the row's own stop condition. Blocking file:
      `src/lib/shared/3d/components/Viewer3DScene.svelte`, where the
      PerformerRig `effectsSlot` payload (`blueHandPos`/`redHandPos`) is
      consumed inline; nothing publishes it to `viewer-3d-state.svelte.ts`,
      which is the adapter's only handle, and `leftPropState.worldPosition` is
      a grid-local prop centre rather than a world hand position. Recorded in
      the matrix.
      `{ kind: "hand" | "prop-tip", performerId, hand: "left" | "right" }`.
      Compile-time aim is the performer's mark at hand height (1.1 m above
      the floor for a hand, 1.4 m for a tip). Runtime live re-aim in the
      adapter from the published positions: check `tip-position-bridge-3d.ts`
      and the PerformerRig `effectsSlot` payload (`blueHandPos`/`redHandPos`)
      for a per-performer world-position source reachable from
      `Viewer3DState`; if none is reachable without a package change, ship the
      compile-time aim, state that in the matrix row, and stop.
- [x] Gap 20: cast-scoped numeric spread. Cast defaults accept
      `beatOffset: number | { canon: number }` (performer k gets k * canon)
      and `sequence.level` accepts `{ ramp: { from, to } }` (linear across
      cast order, rounded to an integer, clamped to the valid level range).
      Rejections: canon or ramp on a single performer (nothing to spread
      across).
- [x] Gap 23: per-performer prop build. Performer and cast defaults accept
      `propBuild: Partial<PropBuild>` validated against the package's
      `PropBuild` keys (read the type; enumerate the keys in the schema so an
      unknown key rejects by name). Adapter calls `setPropBuild` at scene
      apply. Finish stays a matrix rejection ("global finish, one value for
      the whole film") unless a scene-level write to `propFinishState` is
      cheap and reversible on cut; decide with evidence and record it.
- [x] Gap 26: per-hand effect. `effect` (performer, cast defaults, and
      `stepEffects[].effect`) accepts `{ left, right }` in addition to a
      single id. Thread a per-hand pair through `character-instance-state`
      into the `tipEffectMap` that `EffectOrchestrator3D` already consumes;
      the single-id form maps to both hands and must render exactly as today.
      Directive grammar (`pick`) applies per hand. If the tipEffectMap prop
      is not reachable from the performer instance without a package change,
      record the exact blocking file in the matrix and stop.
- [x] Gaps 24, 25, 27 and audio: matrix rejections only, each citing the
      census evidence above and naming the seam a future round would open
      (`headLookAt` writer; `setActiveState` exposure; a runtime look store;
      a clock-synced audio owner).

Wave D result (2026-09-02): 808 film-director unit tests pass (793 before, 15
added in `tests/unit/film-director/wave-d-language.test.ts`). The resolution
snapshot changed only inside the `"Proving Grounds" (proving)` block and its
own `durationSeconds`; every other film is byte-identical. Gap 23's finish
question resolved in favour of per-performer: `finish` is a `PropBuild` key and
`effectivePropBuild` merges the performer's build over the global
`propFinishState.build`, so no write to the package singleton is needed and no
rejection is owed. Gap 26 reaches the renderer through a new
`PerformerSettings.handEffects` plus `setHandEffects`, and the tip map in
`Viewer3DScene.svelte` keys per prop (0 left, 1 right) only when a pair is
present; `EffectOrchestrator3D.svelte` needed no change.

## Named rejections to record in the matrix (no implementation)

- Prop transfer, throws, catches, airborne props (rig-bound props).
- Split screen, second camera, frame composition (one viewer, one track).
- Depth of field, rack focus, motion blur (no post pass).
- Contact work (routed to Contact Lab by `prop-motion-discipline.ts`; outside TKA).
- Prop colour or tint; costume colour (only `characterId` chooses appearance).
- Two configurations of one effect id in one scene (ruled 2026-09-02).
- A performer joining mid-scene: spell it as a `custom` formation with an
  offstage opening mark and a `walk` (already sayable; document the recipe).
- Triangle formation: `v-shape` is the three-slot preset; new presets are a
  scene-package change.
- Audio track / click / hit sync: pending census; expected rejection.

## Final

- [ ] Proving Grounds header comment lists the round-2 scenes.
- [ ] Capability matrix "Round 2" section complete; every census row has a
      speakable spelling or a rejection.
- [ ] Visual gate (Fable, own DevTools): dolly zoom keeps the performer the
      same size while the background stretches; handheld visibly drifts;
      callback scene matches its parent from behind; growing staff grows;
      two lines become one circle at halfway; tempo-double continues the phrase.
- [ ] Merge to main, memory updated, delivery via in-app Browser pane.
