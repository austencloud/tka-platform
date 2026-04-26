# Effects Phase 1e — Bloom Implementation Plan

**Spec:** `docs/superpowers/specs/2026-04-17-effects-phase-1e-bloom-design.md`

Reshapes `BloomIntent` from {intensity, threshold, radius} stub into a full per-tip radial-halo intent. Keeps slot name "bloom" (no rename churn) but pivots the visual contract to per-tip additive radial gradients so the effect earns its slot alone.

## Task ordering

Dependency chain:

1. **Task A — v6→v7 migration + reshape BloomIntent.**
   - `src/lib/shared/effects/domain/EffectsConfig.ts`: bump `EFFECTS_CONFIG_VERSION` 6→7; replace old `BloomIntent` with new shape (see spec).
   - `src/lib/shared/effects/domain/defaults.ts`: new bloom defaults.
   - `src/lib/shared/effects/domain/migrations.ts`: add v6→v7 case. Preserve existing `intensity`. Scale old `radius` 0-1 → new pixel value via `Math.min(80, Math.max(8, (old * 72) + 8))`. Drop `threshold`. Seed new fields from defaults. Leaves `tipEffectMap` entries with `effect: "bloom"` unchanged (still valid).
   - Unit test in `migrations.test.ts` for v6→v7.
   - **Commit:** `chore(effects): bump v6→v7 and reshape BloomIntent for per-tip halos`

2. **Task B — Translator entries.**
   - `src/lib/shared/effects/translators/canvas2d-types.ts`: `Bloom2DParams` mirroring `BloomIntent`.
   - `src/lib/shared/effects/translators/canvas2d-translator.ts`: `resolveBloom2DParams(config)`.
   - `src/lib/shared/effects/translators/webgl3d-types.ts`: `Bloom3DParams`.
   - `src/lib/shared/effects/translators/webgl3d-translator.ts`: `resolveBloom3DParams(config)`.
   - **Commit:** `chore(effects): Bloom2D/3D translator entries`

3. **Task C — Contract + wrapper skeleton.**
   - `src/lib/shared/animation-engine/services/contracts/IBloomOverlayRenderer.ts` with `BloomTipInput { x, y, propIndex, tipIndex, blueColor, redColor }`.
   - `src/lib/shared/animation-engine/services/BloomOverlayRenderer.ts` wrapper (pattern from EchoOverlayRenderer).
   - `src/lib/shared/effects/renderers/Bloom2DRenderer.ts` skeleton (class + dispose + renderFrame stub).
   - **Commit:** `chore(effects): IBloomOverlayRenderer contract + Bloom2DRenderer skeleton`

4. **Task D — Bloom2DRenderer full implementation + unit test.**
   - Per-tip additive radial gradients, 4 colorMode × 3 falloff strategies, pulse modulation math.
   - Unit test in `Bloom2DRenderer.test.ts`: pulse factor at t=0 / t=half-period, falloff stop counts/positions, palette indexing, solid-color path.
   - **Commit:** `feat(effects): Bloom2DRenderer per-tip radial halos`

5. **Task E — Engine wiring.**
   - `src/lib/shared/animation-engine/engines/AnimationEngine.svelte.ts`: `bloomRenderer`, `bloomConfig`, `prevBloomIntentRef`, `lastBloomFrameTime`, `bloomActive`, `bloomDisabledByError`, `consecutiveBloomErrors`, `syncBloomOverlay`, intent-diff entry, resize/dispose hooks.
   - `src/lib/shared/animation-engine/engines/AnimationRenderLoop.ts`: bloom render block after echo; `bloomActive` in `hasActiveWork`.
   - **Commit:** `feat(effects): wire Bloom overlay through AnimationEngine + RenderLoop`

6. **Task F — 3D mount.**
   - New `src/lib/shared/3d/effects/post-processing/BloomBillboard3D.svelte`.
   - Procedural `CanvasTexture` generator (cached via `Map` keyed by `${colorMode}|${falloff}|${color}|${radius}|${paletteKey}|${propColor}`).
   - One `T.Sprite` per tip; reactive `$derived` for opacity driven by pulse factor per frame.
   - `EffectsLayer.svelte`: remove `BloomEffect` post-process mount, add `BloomBillboard3D` (4 sprites — blueA, blueB, redA, redB).
   - **Commit:** `feat(effects/3d): BloomBillboard3D per-tip sprite halos`

7. **Task G — Presets.**
   - New `src/lib/shared/animation-engine/components/effects-panel/presets/bloom-presets.ts` — Candle / Halo / Prism / Twin Stars / Custom (see spec).
   - Pattern from `echo-presets.ts`: `applyBloom()` helper + `activePresets.bloom` sync.
   - **Commit:** `feat(effects): Bloom preset group — Candle / Halo / Prism / Twin Stars`

8. **Task H — Customize panel.**
   - New `src/lib/shared/animation-engine/components/effects-panel/customize/BloomCustomize.svelte`.
   - Pattern from `EchoCustomize.svelte`: 2 chip rows (Color mode, Falloff) + conditional color picker + conditional palette swatches + 4 sliders (Intensity, Radius, Pulse, PulseRate).
   - **Commit:** `feat(effects): BloomCustomize panel — chips + sliders + palette`

9. **Task I — EffectsPanel routing.**
   - `EffectsPanel.svelte`: add `BLOOM_PRESET_GROUP` import; `getPresetGroup` case "bloom"; replace `ComingSoonCustomize` for "bloom" with `BloomCustomize`.
   - `EffectSelector.svelte`: chip stays as-is (label/icon/color unchanged) — verification step only.
   - **Commit:** `feat(effects): route Bloom in EffectsPanel + retire ComingSoonCustomize stub`

10. **Task J — Verification + tag.**
    - `npm run check` (zero new errors beyond the 2 pre-existing VirtualKeyboard).
    - `npm run build` (success).
    - `npm run test` / `npx vitest run` (all pass).
    - Chrome DevTools check if port available (non-blocking).
    - Tag `phase-1e-bloom-complete` at HEAD.

## Commit chain summary

A: `chore(effects): bump v6→v7 and reshape BloomIntent for per-tip halos`
B: `chore(effects): Bloom2D/3D translator entries`
C: `chore(effects): IBloomOverlayRenderer contract + Bloom2DRenderer skeleton`
D: `feat(effects): Bloom2DRenderer per-tip radial halos`
E: `feat(effects): wire Bloom overlay through AnimationEngine + RenderLoop`
F: `feat(effects/3d): BloomBillboard3D per-tip sprite halos`
G: `feat(effects): Bloom preset group — Candle / Halo / Prism / Twin Stars`
H: `feat(effects): BloomCustomize panel — chips + sliders + palette`
I: `feat(effects): route Bloom in EffectsPanel + retire ComingSoonCustomize stub`

## Non-goals

- True fullscreen post-process bloom (deferred; needs post-process slot architecture, which no other effect currently needs)
- Motion-reactive intensity (deferred; echo also chose not to be velocity-reactive in v1)
- Bokeh, chromatic aberration, HDR tone mapping (deferred indefinitely)

## Verification gates

- Every commit: `npm run check` must not introduce new errors.
- Final commit: full test suite + build.
- Tag placement only after all gates green.
