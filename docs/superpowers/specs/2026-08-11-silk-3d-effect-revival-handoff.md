# Silk 3D Effect Revival — Handoff (2026-08-11)

## Mission

Bring the 3D Silk prop effect from its current translucent slab appearance to a
signature ribbon effect that clearly shows surface dynamics and flow quality.
Ghost is being handled separately with Opus 5; Silk is the next weakest effect
in the current sixteen-effect comparison. Start with read-only investigation,
produce one evidence-backed art direction and implementation plan, then stop at
the approval gate until Austen explicitly authorizes implementation. The
original design intent is in
[`2026-04-25-effects-phase-1l-silk-design.md`](./shipped/2026-04-25-effects-phase-1l-silk-design.md).

## Done — verified

- No Silk implementation changes have been made for this assignment. Repository
  inspection on `main` confirmed the behavior owner is
  `SilkRenderer3D`, backed by `SilkRibbonGeometry3D` and the shared two-pass
  `ShaderMaterial`. Evidence: source reads of
  `src/lib/shared/3d/effects/silk/silk-renderer-3d.ts`,
  `silk-ribbon-geometry-3d.ts`, and `silk-ribbon-material-3d.ts` on 2026-08-11.
- The live routing path is confirmed as `EffectOrchestrator3D` to
  `SceneEffectsManager3D` to `SilkRenderer3D`; the renderer is not owned by
  `EffectsLayer.svelte`. Evidence: `rg -n "SilkRenderer3D|resolvedSilk|case
  \"silk\""` across the orchestrator and scene-effects manager on 2026-08-11.
- Existing automated coverage is confirmed in
  `tests/unit/3d-effects/full-roster-renderers-3d.test.ts` and
  `src/lib/shared/effects/translators/webgl3d-translator.test.ts`. Current tests
  prove geometry is emitted and control mappings are monotonic. They do not
  prove that the ribbon reads as silk.

## Believed done — unverified

- Silk was judged the second weakest 3D prop effect after Ghost in a live
  `/test/effect-grid` comparison at 1920x1080 on 2026-08-11. It appeared as a
  broad translucent white rectangular cushion or slab rather than flowing
  fabric. The screenshot was observed in the originating Codex session but was
  not persisted as a repository artifact. Reproduce this comparison and save
  before-change evidence before treating the ranking or diagnosis as proven.
- The strongest current hypothesis is excessive overlapping width: the default
  mapping gives `width: 0.5` a half-width near `0.292` world units, the default
  tracks both ends of both props, and the effect-grid cell overlays two rigs.
  Those wide surfaces can stack into one bright block. This is a source-backed
  inference, not yet isolated experimentally.

## In flight

- Branch: `main`. No branch or worktree was created.
- There are no Silk-specific edits from this assignment.
- The shared checkout is heavily dirty from unrelated live sessions. Do not
  stage, revert, reformat, or commit any file that is not part of the approved
  Silk scope.
- `src/lib/shared/effects/translators/webgl3d-translator.ts` and its test are
  already modified by another session. The current Silk hunk only shows a
  formatting change to the default `override` argument, while the same file has
  substantive Petals work. Treat both files as active overlap and coordinate
  before editing them.

## Loose ends (ranked)

1. Reproduce the defect in `/test/effect-grid` with the same sequence and
   compare Silk at one rig versus two rigs, one tracked tip versus both ends,
   and default width versus a narrow diagnostic width. Persist screenshots or a
   short motion capture. Determine whether the slab comes from width mapping,
   source overlap, ribbon-frame orientation, alpha accumulation, camera angle,
   or a combination.
2. Inspect one Silk source end to end:
   `EffectOrchestrator3D` source registration, `SceneEffectsManager3D` pooling,
   `BoundedSourcePath3D`, geometry generation, fabric pass, glint pass. Record
   confirmed versus inferred findings. Do not bulk-audit unrelated effects.
3. Recommend one final visual direction. Silk must read as attached fabric with
   a narrow, unmistakable head; transported twist; broad but controlled body;
   and a tapered, dissolving tail. It must remain visually separate from thin
   Trails and from Smoke. Reject a particle substitute or a second ribbon
   renderer.
4. Decide how overlapping tips should compose. Both ends cannot become an
   undifferentiated white block. Consider per-prop color identity, attachment
   taper, depth-aware alpha, width normalization by active source count, and
   intentional crossings. Verify each choice against the current intent model
   before proposing new controls.
5. Present the recommended outcome, exact file scope, risks, tests, and visual
   verification plan. Wait for Austen's explicit approval before non-trivial
   implementation.
6. After approval, extend the existing owners. Add focused geometry/material
   tests for the specific silent failure modes found. Verify the finished effect
   in motion and in still frames at the required desktop and 4K viewports, plus
   at least one bright environment. Compare one and two overlaid rigs.

## Decisions already made

- On 2026-08-11, Austen chose to bring the weakest 3D prop effects to 10/10 and
  explicitly enlisted Opus 5 for Ghost. Silk is assigned independently so its
  investigation and files do not overlap Ghost work.
- The target is a full art-direction correction, not a preset-only tune-up.
- Preserve one behavior owner. Extend `SilkRenderer3D`,
  `SilkRibbonGeometry3D`, and `silk-ribbon-material-3d.ts`; do not introduce a
  parallel Svelte Silk component or an alternate renderer.
- The original unique observable remains valid: Trails shows where the prop
  moved; Silk should show how the motion loaded and released a fabric surface.

## Gotchas

- On 2026-08-11, the shared HTTPS dev server on port 5173 served an unrelated
  Root Observatory graybox at `/test/effect-grid` despite the current route
  source. The originating session used the repository-approved isolated Vite
  server on port 5174 to obtain the real effect grid. Never stop or alter the
  5173 server.
- The grid defaults to props off and two overlaid rigs. That is useful for a
  stress comparison but can hide attachment quality and exaggerate alpha
  stacking. Inspect props-on and one-rig states as well.
- `SilkRenderer3D` deliberately owns one shared geometry and two shared meshes
  for every active Silk source. Do not replace that with a mesh per ribbon
  without measured evidence that the shared batching model is the problem.
- The material is already two-pass: normal-blended fabric plus additive glint.
  Adding another glow layer before diagnosing the slab will probably make the
  failure brighter rather than better.
- `PATH_CAPACITY` and `maxPointsPerTip` are both 320, while the shared geometry
  capacity is 6144 samples. Any quality-tier plan must preserve bounded memory
  and avoid per-frame allocations.
- Follow the repository browser rules: use the shared debug Chrome launcher,
  create one task-owned background tab, pass its page ID to every DevTools call,
  emulate viewports per page, clear emulation, and close only that tab.
- Do not claim the effect is fixed from unit tests. Visual proof must show the
  ribbon in motion, at camera distance, and against both dark and bright scenes.
