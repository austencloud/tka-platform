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

- [ ] **Phase 0 — resolution snapshot harness** (gate for everything after).
      Snapshot the resolved spec of every library film with numbers rounded to
      1e-6. Any later phase that changes a snapshot must show why.
- [ ] **Gap 9 — `distinct` + `not` combined spelling.** Add optional `not` to
      the `{pick}` branch of the directive grammar; normalize to the
      already-supported `{kind:"pick", distinct, pool, exclude}`. Scene-scoped
      axes keep rejecting `distinct` but accept `{pick:"any", not}`.
- [ ] **Gap 1 — beats as a time unit.** `durationBeats` beside every
      `durationSeconds` (scene, transition, blocking moves, scene blocking,
      camera moves) and `atBeats` beside keyframe `atSeconds`. Converted once,
      early in `resolveScene`, via `beats * 60 / bpm` (the scene's own bpm);
      compilers stay seconds-only. Bounds validated post-conversion with
      beats-speaking error text. Version bump to 4 lands here.
- [ ] **Gap 8a — camera edges: truck / zoom / roll.** New moves in the
      framing-grammar move compiler: `truck` (lateral meters, left/right),
      `zoom` (fov delta or target fov), `roll` (degrees, cw/ccw — needs a
      camera-up channel through the resolved keyframe + sampler + viewer rig;
      verify the viewer seam first, descope roll to a documented rejection if
      the rig cannot bank).
- [ ] **Gap 3 — camera tracks a walking performer.** Resolved camera track
      gains `tracking: { performerId, mode: "aim" | "follow", height? } | null`
      spoken as `subject: {kind:"performer", performerId, track: true|"follow"}`.
      Sampling-layer composition in `sampleFilmDirector`: after sampling camera
      + blocking, offset target (aim) or target+position (follow) by the
      tracked performer's live displacement from their opening mark. Keyframe
      compiler untouched.
- [ ] **Gap 4 — mid-scene cut.** `camera.shots: [...]` — a list of framing
      blocks each with its own subject/shotSize/angle/position/moves and a
      duration (seconds or beats); hard cut between consecutive shots.
      Exclusive with single-framing fields, presets, and raw keyframes.
      Compiles to one keyframe track with step-interpolation boundaries.
- [ ] **Gap 5 — sequence transforms + library source.** Sequence sources gain
      `{transformOf: performer, transforms: [...]}` for the operations
      `sequence-transformer.ts` already owns (rotate/invert/swap/retrograde…;
      exact speakable list fixed at design time after reading the transformer),
      with `mirrorOf` kept as sugar. Plus a saved-library-sequence source if
      the loader seam is workbench-safe (async like word generation) — verify
      first, descope honestly if not.
- [ ] **Gap 2 — per-beat changes.** Per-performer `stepEffects` (and
      `stepEfforts` if the adapter seam allows live effort swap) following the
      stepPlanes shape; freeze/hold on a beat only if the playback seam
      supports per-performer step remapping cheaply. Design task reads
      `director-viewer-adapter.ts` + `FilmDirectorScene.svelte` fully first.
- [ ] **Gap 6 — per-performer effect presets/overrides.** Design task first:
      determine whether the effects engine can hold two configs of one effect
      id in one scene. If yes: `performer.effectPreset`/`effectOverrides`
      override scene-scoped ones. If no: a clear rejection message naming the
      constraint, plus capability-matrix documentation. No pretending.
- [ ] **Gap 7 — blocking edges.** `run` (only if the locomotion owner has a
      run gait — locomotion.md forbids inventing one), arc paths
      (`along: "arc"` resolved into chord segments at compile time, no runtime
      change), offstage entrances (positions outside stage bounds + walk in —
      verify stage-extent handling), stand-and-watch (`sequence: {source:"none"}`
      — performer idles, no prop phrase; needs adapter support for a
      sequence-less performer).
- [ ] **Gap 8b — orbit cw/ccw felt-direction confirmation.** Two-scene demo in
      proving-grounds (one cw, one ccw orbit over distinguishable staging);
      pane delivery asking Austen which reads clockwise. One-line flip in
      `camera-language.ts` if wrong. This is the only gap gated on his eyes.
- [ ] **Final — showcase + docs + memory.** Bake proving-grounds poster
      (`node scripts/build-film-posters.mjs --only proving` on :5173),
      capability-matrix sweep, memory file update, worktree cleanup.

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
