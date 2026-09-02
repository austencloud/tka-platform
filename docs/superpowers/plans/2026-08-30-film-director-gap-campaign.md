# Film Director Gap-Closure Campaign — Master Ledger

> Approved by Austen 2026-08-30: "take on each one of those gaps one by one
> ensuring that we test with the proper gates along the way using sub agents
> that are highly qualified ... we check their work to make sure that we don't
> just lie on faith but instead we get a visual experience that says OK this is
> definitely working as intended. I'm happy to have all of the things that you
> suggested be included."

**Goal:** close all nine speakability gaps found by the 2026-08-30 directive-language
audit, one gap at a time, each behind test gates and a visual proof.

**Worktree:** `E:/worktrees/tka-platform/director-gaps`, branch `claude/director-gaps`.
Primary checkout stays on `main`. Merge to main per gap (`--no-ff`), never push.

**Schema era:** this campaign is grammar v4. Gap 1 adds
`FILM_DIRECTOR_SCHEMA_VERSION_4`; the schema keeps accepting 1|2|3|4. New
proving-film scenes author at version 4.

## Process contract (binds every gap)

1. **Design locked in a per-gap plan doc** (`2026-08-30-film-director-gap-<n>-*.md`)
   with real code, per superpowers:writing-plans. Written just-in-time, because
   later gaps build on earlier landings.
2. **Implementation by subagent** with explicit `model` + `effort`
   (fable-routing): sonnet for routine work from a complete plan, opus for
   hard/multi-file work. Every subagent prompt carries: re-read the plan doc
   first; prove completion with tool output; commit with explicit pathspec.
3. **Adversarial check, not faith:** after the subagent reports, the main loop
   (Fable) reads the full diff itself, and a second review subagent (opus)
   hunts for defects in the diff. Findings are fixed before the gap closes.
4. **Test gates**, all green before merge:
   - New grammar gets accept/reject schema tests + resolver behavior tests
     (the adversarial-corpus pattern).
   - `tests/unit/film-director/film-resolution-snapshot.test.ts` (Phase 0):
     the 8 shipped films' resolved specs stay byte-identical, or the diff is
     shown and justified in the gap's commit message.
   - Full film-director vitest project green.
5. **Visual proof, my own eyes:** every gap lands a scene in the
   `proving-grounds` film that exercises the new grammar. I run a worktree
   vite server (own port, reaped end of session; resource-budget gates), load
   `/test/film-director?film=proving`, and screenshot the scene demonstrating
   the behavior (DevTools MCP, webp q70, `window.__filmDirectorViewer` for
   runtime state). Visual judgment is never delegated to a subagent.
6. **Docs in lockstep:** `docs/reference/film-director-capability-matrix.md`
   gains/updates rows per gap. If a gap adds a directive axis, the
   `<!-- directive-axes -->` comment and `FILM_DIRECTOR_DIRECTIVE_AXES` move
   together (capability-matrix.test.ts locks them).
7. **Determinism guard:** golden vectors in `directive-random` never change.
   No new call sites reorder existing per-(scene,axis) stream draws — new
   randomness gets new axis names.

## Gap sequence and status

- [x] **Phase 0 — resolution snapshot harness** (gate for everything after).
      Snapshot the resolved spec of every library film with numbers rounded to
      1e-6. Any later phase that changes a snapshot must show why.
- [x] **Gap 9 — `distinct` + `not` combined spelling.** Add optional `not` to
      the `{pick}` branch of the directive grammar; normalize to the
      already-supported `{kind:"pick", distinct, pool, exclude}`. Scene-scoped
      axes keep rejecting `distinct` but accept `{pick:"any", not}`.
- [x] **Gap 1 — beats as a time unit.** `durationBeats` beside every
      `durationSeconds` (scene, transition, blocking moves, scene blocking,
      camera moves) and `atBeats` beside keyframe `atSeconds`. Converted once,
      early in `resolveScene`, via `beats * 60 / bpm` (the scene's own bpm);
      compilers stay seconds-only. Bounds validated post-conversion with
      beats-speaking error text. Version bump to 4 lands here.
- [x] **Gap 8a — camera edges: truck / zoom / roll.** New moves in the
      framing-grammar move compiler: `truck` (lateral meters, left/right —
      position AND target translate together along the camera-right ground
      axis; rejects from a straight-down framing), `zoom` (fov delta in
      degrees, in/out, rejects outside 20–100 with the numbers named), `roll`
      (degrees, cw/ccw, sparse `rollDeg?` on resolved keyframes so the 8
      shipped films' snapshots stayed byte-identical). The 2026-08-30 roll-seam
      note was WRONG in practice: a one-shot `rotateZ` in
      `applyDirectorCameraFrame` was erased every tick by camera-controls'
      `update()` (visual gate 2026-08-31 measured a level horizon at
      `rollDeg: 10`). Fixed 2026-09-01 by moving roll into viewer state
      (`viewer3DState.cameraRollDeg`) re-applied by `Viewer3DCamera` in a task
      ordered `after` the controls' keyed task. Also fixed from the gate: flat
      fov/roll segments no longer bow under Catmull-Rom (`interpolateLensScalar`),
      and the proving truck dropped 2 m → 1 m so blue stays in frame at the
      zoom. Visual proof: camera x-axis 9.975° off horizontal at `rollDeg: 10`,
      performers leaning left (camera rolled cw, picture counter-rotates), fov
      35.17 at zoom end, horizon level through the truck. 596/596 unit tests.
- [x] **Gap 3 — camera tracks a walking performer.** Closed 2026-09-01.
      Spoken as `subject: {kind:"performer", performerId, track: true|"follow"}`;
      resolved as optional `camera.tracking: {performerId, mode:"aim"|"follow"}`
      (absent, not null, when unused so the eight shipped snapshots stay
      byte-identical). `applyCameraTracking` in `sample-film-director.ts`
      offsets target (aim) or target+position (follow) by the walker's live
      displacement from their resolved opening mark; keyframe compiler
      untouched. `track` on preset/keyframe targets rejects. Proving scene 4
      `tracking-shot`: a 3 m downstage crossing under a following medium shot.
      Visual gate at 1920×1080: walker centered at 0 s, mid-walk (≈3 s) and
      standing (≈7 s) frames with the forest sliding behind; the first staging
      walked through the partner's mark along z = 0 and was moved downstage
      to (-1.5, -1.8). 611/611 tests.
- [x] **Gap 4 — mid-scene cut.** `camera.shots: [...]` — a list of framing
      blocks each with its own subject/shotSize/angle/position/moves and a
      duration (seconds or beats); hard cut between consecutive shots.
      Exclusive with single-framing fields, presets, and raw keyframes.
      Compiles to one keyframe track with step-interpolation boundaries.
      **Accepted 2026-09-02** (worktree `c5b004dcec` + close-out): suite
      632/632; proving scene 5 sampled on the running workbench at 1920×1080 —
      wide front hold through scene time 2.99 s, close-up at 3.01 s pushing
      0.4 m to 5.99 s, high-behind at 6.01 s; three frames read wide two-shot /
      low close-up on performer 1 / high behind two-shot with no glide. Cut
      transition default duration is now 0, which changed only
      `transition.durationSeconds` in five shipped films' snapshots.
- [x] **Gap 5 — sequence transforms + library source.** Sequence sources gain
      `{transformOf: performer, transforms: [...]}` for the operations
      `sequence-transformer.ts` already owns (rotate/invert/swap/retrograde…;
      exact speakable list fixed at design time after reading the transformer),
      with `mirrorOf` kept as sugar. Plus a saved-library-sequence source if
      the loader seam is workbench-safe (async like word generation) — verify
      first, descope honestly if not.
      **Accepted 2026-09-02** (commits `8ee379c537`..`08f34afe1c`): ops
      mirror/flip/invert/rewind (optional hand), rotate (45° multiples, cw/ccw),
      swap-hands, start-at; `{library: <publicSequences id>}` loads through
      `batchFetchPublicSequences` (world-readable). Suite 659/659; snapshot
      changed only in the proving block. Visual gate on the workbench at
      1920×1080, film time 50 s and 53.2 s: Firestore fetch observed, no
      fallback warning in the console, and the three performers show three
      different pictures (library source, rotated + swapped hands, retrograde).
- [x] **Gap 2 — per-beat changes.** Per-performer `stepEffects` (and
      `stepEfforts` if the adapter seam allows live effort swap) following the
      stepPlanes shape; freeze/hold on a beat only if the playback seam
      supports per-performer step remapping cheaply. Design task reads
      `director-viewer-adapter.ts` + `FilmDirectorScene.svelte` fully first.
      Shipped 2026-09-02 (`b09d7a696f`..`73ff889a75`): `stepEffects`,
      `stepEfforts`, and `holds` resolve per frame and write through
      `setEffect`/`setEffort` on each performer; Proving Grounds scene 8
      (64–72 s) demonstrates all three.
      Acceptance (main-loop review, 2026-09-02): runtime state on :5201 showed
      performer 1 `rawEffect` none → trails at step 4 → fire at step 8 with
      `effectiveEffortId` punch, while performer 2 held step 4 for four beats.
      The visual gate first FAILED: no effect drew anywhere in the workbench,
      even when set by hand. Root cause was outside the gap — Viewer3DScene's
      `effectsSlot` snippet destructured `leftPropState`/`rightPropState` while
      `PerformerRig` publishes `bluePropState`/`redPropState`, so the
      orchestrator received `undefined` prop states and every 3D effect was
      silently disabled for every viewer host (pre-existing on `main`). Fixed
      by renaming at the seam; locked by
      `tests/unit/3d-viewer/viewer3d-effects-slot-contract.test.ts`. After the
      fix, canvas frames at 67.0 s show blue and red trails on performer 1 with
      performer 2 clean, and at 69.5 s fire on all four staff ends of
      performer 1 only. Console clean.
- [x] **Gap 6 — per-performer effect presets/overrides.** Design task first:
      determine whether the effects engine can hold two configs of one effect
      id in one scene. If yes: `performer.effectPreset`/`effectOverrides`
      override scene-scoped ones. If no: a clear rejection message naming the
      constraint, plus capability-matrix documentation. No pretending.
      **Ruled NO and closed 2026-09-02** (commit `2998cb963b`). The design
      pass found `EffectsConfigState` is one `Record<effectId, Intent>` per
      scene, replaced once by `applyDirectorEffectPresets`, and read flat by
      `EffectOrchestrator3D` for every performer's tips. `effectPresets` /
      `effectOverrides` on a performer or in cast defaults now reject with
      `PERFORMER_EFFECT_CONFIG_MESSAGE`; documented under "Spoken but not
      real". 663/663 tests; snapshot untouched. Non-visual, no frame needed.
- [x] **Gap 7 — blocking edges.** `run` (only if the locomotion owner has a
      run gait — locomotion.md forbids inventing one), arc paths
      (`along: "arc"` resolved into chord segments at compile time, no runtime
      change), offstage entrances (positions outside stage bounds + walk in —
      verify stage-extent handling), stand-and-watch (`sequence: {source:"none"}`
      — performer idles, no prop phrase; needs adapter support for a
      sequence-less performer).
      Closed 2026-09-02: arc paths and stand-and-watch shipped as capability,
      offstage entrances were already legal and are now documented, `run`
      shipped as a named rejection. The Task 1 spike took branch A — a
      performer with no loaded sequence renders an idle body, throws nothing,
      and holds no prop.
      Acceptance (main-loop review, 2026-09-02): 683/683 film-director tests.
      Visual gate on :5201 at 1920×1080, film time 56.0 s: two bodies in the
      medium shot, the idle performer empty-handed, the entrant reported at
      (8, -1) and outside the frame. At 59.5 s the entrant is inside the
      frame edge at (4.14, -2.08), 1.2 m/s, downstage of the straight chord.
      No console errors or warnings. The executor's staging (opening mark at
      x = 5, wide group shot) was inside the frame from the first beat, so
      the scene was restaged to x = 8 over twelve beats under a medium shot
      on performer 2 before commit.
- [ ] **Gap 8b — orbit cw/ccw felt-direction confirmation.** Two-scene demo in
      proving-grounds (one cw, one ccw orbit over distinguishable staging);
      pane delivery asking Austen which reads clockwise. One-line flip in
      `camera-language.ts` if wrong. This is the only gap gated on his eyes.
- [ ] **Final — showcase + docs + memory.** Bake proving-grounds poster
      (`node scripts/build-film-posters.mjs --only proving` on :5173),
      capability-matrix sweep, memory file update, worktree cleanup.

## Wave 1 acceptance record (Phase 0 + Gap 9 + Gap 1)

- **Executor commit** `e8324a0208`; full diff read by the main loop; opus
  review subagent returned 23 findings. 18 fixed pre-merge (error copy
  reporting post-exclusion candidates, 2-decimal number formatting in all
  user-facing rejections, "the default 90 bpm" when tempo was unstated,
  normalizeDirective no-key fallthrough guard, real non-mutation tests for
  convertSceneBeatTimes, snapshot-harness film-key guard + non-finite
  sentinel, stronger push/plane assertions, seed pinned so the combined draw
  shows six unique planes, naming/doc fixes). 2 deferred with owners: the
  `transition {kind:"cut"}` scene still resolving a 0.8 s transition window
  is pre-existing behavior deferred to **Gap 4** (which owns cut semantics);
  the proving film not yet exercising `atBeats` keyframes /
  `transition.durationBeats` / blocking-defaults beats is deferred to later
  waves, whose appended scenes use those spellings naturally. 3 were already
  fixed in the working tree when reviewed.
- **Visual gate, scene 2 (On the Beat):** the first two arrivals failed the
  frame test — a medium two-shot pushed 1.5 m ended inside the performers'
  bodies, and after widening, a group-aimed camera held vacated space for the
  closing four seconds while the walker sat half-cropped at the frame edge.
  Fixed in grammar, not post-production: `subject: {kind:"performer",
  performerId:"performer-1"}` (aim at the mark-holder, not the vacated group
  center) plus a 1.0 m push. Mid-walk and arrival frames both verified at
  1920×1080 — walker crosses through center, arrival is a layered two-shot,
  nothing cropped.

## Proving film

`src/routes/test/film-director/_films/proving-grounds.ts`, key `proving`,
label "Proving Grounds", registered in `_films/index.ts`. One scene per gap,
titled after the gap, each `intent` naming exactly what to look for. This film
is the campaign's visual gate artifact AND its living regression fixture:
film-library.test.ts resolves it like any other film.

## Standing constraints (verbatim from rules; do not relitigate)

- Never start/restart/stop :5173 (Austen's Agent Hub button; IPv6 `[::1]` trap).
- Own vite server: free port, RAM gate ≥ 4 GB, reaped before session end.
- Commits: explicit pathspec only. No push.
- TKA domain claims need current-turn MCP evidence.
- Existing 8 films keep resolving; poster gate stays green.
