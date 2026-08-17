# LED Simulator Implementation Plan (Ledger)

**Spec:** `docs/superpowers/specs/2026-08-16-led-simulator-design.md` — executors read it first.
**Discipline:** every executor proves completion with tool output, commits nothing
(the orchestrating session reviews and commits per phase with explicit pathspecs).

## Phase 1 — Shared domain promotion (Sonnet)

- [x] Move `IPatternPreset` + `BUILT_IN_PRESETS` from
      `src/lib/features/poi/domain/pattern-preset.ts` to
      `src/lib/shared/poi/domain/pattern-presets.ts`; update all imports
      (`strip-pattern-engine.ts`, poi state/components). Old file deleted.
- [x] Promote `StripPatternEngine.toImageData` to a pure function
      `stripPatternToImageData(pattern)` in `src/lib/shared/poi/domain/`
      (new `strip-pattern-image.ts`); the engine method delegates to it.
- [x] Move `src/lib/features/poi/services/poi-image-library.ts` to
      `src/lib/shared/poi/services/poi-image-library.ts`; update imports.
      (Needed so the shared customize panel can list image patterns without a
      shared→features import violation.)
- [x] Add `chase` and `comet` generators to the shared preset set, visually
      distinct from each other and from pulse (chase: hard-edged moving block;
      comet: bright head + exponential tail).
- [x] Unit tests: generator distinctness (no two generators identical on
      default params), chase/comet sanity, `stripPatternToImageData`
      round-trip.

## Phase 2 — Config v2, sampler, 2D pipeline (Opus)

- [x] `led-types.ts`: `LedOverlayConfig` v2 per spec §3 (`device`, `pattern`,
      `cycleDuration` 0.2–30, `look`). Delete unused `PropLedConfig`/`LedPoint`.
      Keep `LED_BRIGHTNESS_LEVELS`.
- [x] Pure migration function v1→v2 + unit tests (solid+color → capsule solid;
      spectrum family → rainbow-sweep pixel-staff 200; unknown → default).
- [x] `led-tip-tracker.ts` → LED sampler: device → per-LED world positions
      (capsule = the 2 tip points; pixel staff = lerp between tip endpoints,
      N∈{32,72,200}) + per-LED color from a materialized `StripPattern`
      (generated once per config change, cached; frame index
      `floor(((elapsed / cycleDuration) % 1) * frameCount)`).
- [x] `LedFrameInput` contract: per-LED positions + colors. Update
      `web-gl-led-renderer.ts` (MAX_LEDS 32→400),
      `web-gpu-led-executor.ts` (MAX_LEDS 64→400), `led-translator.ts`,
      `led-pass.ts`, `led-pass-executor.ts`.
- [x] Migrate consumers: `effect-system.ts`, `effect-renderer-manager.ts`,
      `animation-engine.svelte.ts`, `effect-controller.ts`,
      `animation-render-loop.ts`, `IAnimationRenderLoop.ts`,
      `canvas-lifecycle-manager.ts`, video-trails `effect-config-mapper.ts` +
      `video-tip-adapter.ts`, `EffectControlStack.svelte`,
      `EffectTuneStrip.svelte`, `led-patterns.ts` (delete if fully subsumed).
- [x] Delete `src/lib/shared/animation-engine/domain/patterns/` (registry,
      evaluators, descriptors, context) once no imports remain. Grep-proof.
- [x] Evidence: targeted vitest on effect suites + `npm run check` log.

## Phase 3 — 3D routing (Opus)

- [x] `EffectOrchestrator3D.svelte`: capsule → `led-renderer-3d.ts` (2 LEDs);
      pixel staff → `pov-strip-renderer-3d.ts` (instanced ghosts), driven by
      the same materialized pattern + clock. Quality tiers per spec §5.
- [x] Evidence: 3D effect tests + check. 408 tests green across
      `tests/unit/3d-effects` + `tests/unit/effects` (30 new);
      `npm run check` 0 errors 0 warnings.
- [~] Tunnel-copy LED decimation deferred: the 3D LED path has no overlay
      concept (one blue + one red prop state per rig), so there is nothing to
      decimate. 2D-only concern.

## Phase 4 — Presets, thumbnail, panel (main session — visual, never fanned out)

- [ ] `led-presets.ts`: six device+pattern+look bundles per spec §4.
- [ ] `LedThumbnail.svelte`: POV-arc portrait painted from the preset's own
      pattern via `stripPatternToImageData`; route in
      `EffectPresetThumbnail.svelte`.
- [ ] Rebuild `LedCustomize.svelte` (replaces `LedPanel.svelte`): device
      SegmentedControl, visual pattern grid, conditional color swatches,
      cycle-duration control, Look group. No layout shift on device toggle.
- [ ] Image showcase preset: built-in pattern image under `static/`, honest
      fallback to gradient on load failure.
- [ ] Visual verification loop at required viewports (thumbnails, panel,
      running effect 2D+3D, capsule + 200-LED staff).

## Phase 5 — Ship

- [ ] Full `npm run check` (one run, logged) + effect test suites green.
- [ ] Commits per phase, explicit pathspecs, only LED-task files.
