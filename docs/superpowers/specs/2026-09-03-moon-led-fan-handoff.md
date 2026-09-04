# Moon LED Fan handoff

## Mission

Ship the platform's first LED fan as a credible digital twin of the Lighttoys
Moon Fans FT: a 60 cm stretched diffusion skin over a framed fan, lit by 78
addressable LEDs in two 39-emitter physical segments. The result must preserve
the platform's existing LED pattern pipeline rather than behave like a fixed
two-color prop.

Primary product reference: <https://www.lighttoys.cz/product/moon-fans-ft/>

## Done — verified

- The original Moon build landed in commit `051b256df0` and includes the physical
  GLB build, fan appearance picker entry, 2D artwork, automatic LED build
  selection, effect anchors, source ledger, build verification, and focused
  tests.
- The realism pass landed in commit `e456d98be8`:
  - the diffuser samples the complete 78-pixel materialized LED strip every
    frame through a 78 × 1 GPU data texture;
  - one continuous strip maps from the left endpoint, across the crown, to the
    right endpoint, preserving gradients, rainbow generators, and uploaded
    image patterns;
  - individual emitter cores and broader fabric halos remain distinct;
  - hidden frame members, center seam, grip occlusion, tension folds, and a
    subtle crossed weave modulate the transmitted light;
  - two shared-resource optical faces sit outside the physical shell, so both
    sides emit while normal scene depth still occludes the fan behind hands,
    performers, and props;
  - the generic five oversized LED head sprites are suppressed for Moon builds;
  - the real `EffectOrchestrator3D` can now be mounted by the prop capture route
    with `effect=led`, and `ledPattern=rainbow` proves full-strip routing.
- `pnpm run check`: 0 errors and 0 warnings.
- Focused Vitest run: 5 files, 40 tests passed:
  - `tests/unit/3d-effects/build-for-effect.test.ts`
  - `tests/unit/3d-effects/led-device-routing-3d.test.ts`
  - `tests/unit/3d-effects/moon-fan-led.test.ts`
  - `tests/unit/3d-viewer/fan-appearance-state.test.ts`
  - `tests/unit/3d-viewer/fan-moon-build.test.ts`
- Chrome DevTools rendered the production orchestrator at:
  `/test/prop-3d-studio/capture?prop=fan&fanBuild=moon&effect=led&ledPattern=rainbow&rz=-90&zoom=0.92`.
- The front face, reverse face (`ry=180`), physical A/B color pattern, and full
  rainbow strip were visually inspected. The rainbow proof showed distinct
  addressable color travel around the full crescent, visible emitter cores,
  soft fabric diffusion, and frame pressure shadows.
- Required viewport sweep passed at 1920 × 1080, 2560 × 1440, 3840 × 2160,
  1440 × 900, 820 × 1180, 960 × 412, and 375 × 667. The prop stayed centered,
  uncropped, and legible. Browser console: no warnings, errors, or issues.
- The `shared/3d` audit was recorded under claim
  `agent-1788495910094-s0rpo2`. Overall scope grade: C due to pre-existing
  cross-module findings. The evaluator cited no Moon diffuser violation and
  verified disposal of its GPU resources and both orchestrated instances.

## Believed done — unverified

- Selecting Moon plus LED through the full Effects Lab picker is believed to
  reach the same verified production orchestrator, but that click path was not
  re-proven in this session. Opening the global prop picker repeatedly closed
  the Chrome DevTools target before the realism pass. The dedicated capture
  route exists because it exercises the production renderer without that
  unrelated picker instability.

## In flight

- None. The authoring branch `codex/moon-led-fan-polish` was integrated into
  local `main` by merge commit `5fa6106b1a`. Its task branch and worktree were
  removed after ancestry and path checks. The merged HTTPS route was then
  rendered again at 1920 × 1080 on port 5173: the capture diagnostics reported
  the expected `0.602:0.399:0.035` prop bounds, the full rainbow diffuser was
  visible, and the browser console contained no warnings, errors, or issues.

## Loose ends — ranked

1. **P3, optional:** Investigate the Chrome DevTools target closure in the full
   Effects Lab prop picker. It did not reproduce on the capture harness and did
   not emit a browser console error before the target disappeared.
2. **P3, future realism:** A scene-level colored light cast from the whole fan
   onto performers and nearby environments could add another optical layer.
   The current result correctly owns the emissive surface and scene-depth
   behavior; it does not allocate 78 physical lights.

No loose end blocks this feature's release.

## Decisions already made

- The closest behavior owner is `EffectOrchestrator3D`; the capture route
  composes it and does not implement a parallel LED renderer.
- LED content remains owned by `LedPatternMaterializer` and the shared pattern
  clock. Moon consumes that data at a physical 78-pixel resolution.
- The two 39-emitter segments are treated as one continuous addressable crescent
  for pattern mapping, with the physical segment boundary at the crown.
- The GLB owns the white cloth and frame. The Moon shader owns only transmitted
  light, which prevents a glowing plastic-disc appearance.
- Two offset, depth-tested faces were chosen over `depthTest: false`. The latter
  looked correct in isolation but would render through hands and avatars.
- The reverse side intentionally exposes the physical spokes more clearly than
  the front, matching a skin stretched over a supporting frame.
- Reference provenance remains in
  `scripts/assets/moon-fan-reference.json`; do not replace verified dimensions
  or LED counts from memory.

## Gotchas

- A fresh worktree's local Vite server may need
  `pnpm --filter @tka/tka-types build` before imports resolve. This is a local
  workspace setup issue, not a Moon runtime dependency.
- Port 5173 is Austen's shared HTTPS dev server. Do not restart or kill it.
  Task-owned validation used Vite on port 5174.
- Background Chrome tabs advance the 30-frame capture-ready counter slowly due
  to timer throttling. `captureSize` and `captureStableFrames` are exposed as
  body data attributes for deterministic diagnostics.
- Resize/emulation can temporarily drop a WebGL context after a 3840 × 2160
  frame. Reload the task-owned tab at the new viewport; do not restart the
  shared browser.
- The browser screenshot writer rejected both the task worktree and the
  configured visualization directory as outside its internal roots. Visual
  proof was inspected inline but not persisted as repo image files.
- Keep Moon-specific optical detail in
  `moon-fan-diffuser-renderer-3d.ts`. Generic LED ribbons and POV staff behavior
  belong to their existing renderers and should not absorb fan-fabric logic.
