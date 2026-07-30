---
status: active
value: 3
effort: S
remaining: "The trail envelope, focused tests, LOW/HIGH visual proof, and maximum-Coven stability proof are complete. A 2026-07-30 close-out check again found seven TypeScript errors, all in the unrelated untracked WorkspaceShareControl.svelte and none in trail files. Rerun pnpm run check after that share-control work is green, then move this spec to shipped."
depends_on: "external: shared full check is blocked by another session's untracked WorkspaceShareControl.svelte type errors"
plan_path: ""
tags: []
last_triaged: 2026-07-30
---
# 3D Trail Parity — Design

**Goal:** Replace the three competing/dead 3D trail implementations with ONE gorgeous trail that visually matches the 2D WebGL2 GPU-accumulator trail (glow halo, decay fade, taper), and wire it into the live render path so it actually renders in the sequence viewer and the coven hub.

**Status:** Approved 2026-05-29.

---

## Problem

Audit (2026-05-29) found:

- The beautiful trail is 2D only: `trail-overlay-web-gl2.ts` — a per-tip GPU accumulator with `GLOW_RATIO 2.5` additive halo, `decayRateFor(fadeDurationMs)` decay, `FADE_EXPONENT 2.5` falloff, `MIN_TAIL_WIDTH_RATIO 0.3` taper, and a 300ms-in / 200ms-out alpha envelope.
- 3D has THREE trail attempts, none of which render:
  - `RibbonTrail3D.svelte` — Verlet physics rope (gravity/drag). Wrong model: it dangles, it is not a tip-path trail. Mounted by `EffectsLayer.svelte` (4×) — but `EffectsLayer` is itself unmounted.
  - `Trail3D.svelte` + `TrailRenderer3D.ts` — Catmull-Rom ribbon, billboarded, time-fade. A real motion trail. Mounted by `EffectOrchestrator3D.svelte` — also unmounted.
  - `TrailRenderer.svelte` — TubeGeometry. Imported, never mounted.
- `PerformerRig` (the component the viewer AND coven actually render) only emits effects through an `effectsSlot` snippet: `{#if showEffects && effectsSlot}`. No consumer in `src/` provides an `effectsSlot`, so no orchestrator mounts and no 3D trail renders. The only 3D "trail" is a static 0.015-radius debug sphere in `Staff3D`.

## Decision

ONE trail: the **Catmull-Rom billboard ribbon** (`Trail3D.svelte` + `TrailRenderer3D.ts` + `TrailMaterial3D.ts`). It is a true tip-path trail, already billboards toward the camera, and is the slot content the package's own `PerformerRig` doc names (`EffectsGroup → EffectOrchestrator3D`).

Delete `RibbonTrail3D.svelte` (Verlet rope) and `TrailRenderer.svelte` (tube).

## Architecture

### Capture source

Per-frame 3D tip world-positions come from `calculatePropEnds(propState)` (already implemented in `EffectsLayer.svelte:190` and `EffectOrchestrator3D.svelte`), returning `{ positive: Vector3, negative: Vector3 }` per prop. Four tips total: blue/red × positive/negative end. This is the 3D analog of the 2D ring-buffer tip capture.

### Parity mapping

The 2D look is four mechanisms. Each maps to the 3D ribbon:

| 2D mechanism | 3D port |
|---|---|
| Centripetal Catmull-Rom smoothing (`render-graph/math/trail-mesh.ts`) | `TrailRenderer3D` already does Catmull-Rom; reuse the shared exported constants `FADE_EXPONENT = 2.5` and `MIN_TAIL_WIDTH_RATIO = 0.3` from `trail-mesh.ts` so the curve matches exactly (DRY — do not redefine). |
| Taper head→tail | per-vertex width ramp `width = thickness * (taperTailRatio + (1 - taperTailRatio) * progress)`, `progress` = 0 at tail, 1 at head |
| `FADE_EXPONENT` opacity falloff | per-vertex alpha `maxAlpha * (1 - (1 - progress)^FADE_EXPONENT)` |
| `GLOW_RATIO 2.5` additive halo | shader halo in `TrailMaterial3D`: `edge_t` Gaussian falloff across ribbon width + additive blend + HDR emissive (`color * emissiveStrength`, strength > 1) |

Plus the fade-in/out envelope: trail alpha ramps 300ms in / 200ms out so it appears and vanishes with the prop. Match the curve of `Canvas2DVisibilityFadeManager(300, 200)`.

### Hybrid glow (tier-gated)

Glow has two layers, gated by the existing effects quality tier (`getQualityTierDetector().currentConfig`, tiers HIGH/MEDIUM/LOW, `enableBloom` true/true/false):

- **Shader halo — always on, every tier.** Emissive ribbon + `edge_t` falloff + additive blend. This alone matches the 2D (whose glow is itself a widened additive splat, not a true bloom). Per-trail, no full-screen pass, scales to the coven's ~144 rigs.
- **Bloom — HIGH/MEDIUM only.** Emit emissive as HDR (`color * strength`, strength chosen so peak luminance > the bloom `luminanceThreshold`). A scene composer with `BloomEffect` then blooms it. Bloom is one full-screen pass regardless of rig count (cost is resolution-bound, not object-bound) — coven-safe.

### Bloom availability

Today `ScenePostProcessing.svelte` builds its `EffectComposer` only when `shouldCompose = isOcean && !isExporting`, so bloom is ocean-only. To make tier-gated bloom reach non-ocean scenes (coven uses `ForestScene`; the viewer uses various):

- Extend `shouldCompose` to also be true when the effects tier has `enableBloom` AND trails are active in the scene, scene-agnostic.
- When the composer runs only for the bloom path (non-ocean), build a minimal pass chain: `RenderPass` + `EffectPass(BloomEffect)` (skip the ocean-only water/caustics/absorption passes).
- Keep the existing ocean behavior unchanged when `isOcean`.

This is the riskiest edit: building a composer disables `autoRender` and adds a full-screen pass for non-ocean scenes on high tier. Acceptable because it is exactly what "tier-gated glow" means, and it is one pass, not 144.

### Wiring into the live path

Root cause of "no trails render" = no `effectsSlot` provider. Fix:

- Provide an `effectsSlot` snippet to `PerformerRig` in `Viewer3DScene.svelte` and `CovenStation.svelte`.
- The slot renders `EffectOrchestrator3D` (the package-intended slot content, already using `Trail3D`).
- Forward `tipEffectMap` through the orchestrator so per-tip trail gating works (matches the 2D `resolveEffect(propIndex, tipIndex, tipMap)` gating).

## Components

| File | Action | Responsibility |
|---|---|---|
| `effects/trails/Trail3D.svelte` | keep | Svelte wrapper: subscribes tip position, drives the ribbon engine |
| `effects/trails/TrailRenderer3D.ts` | keep + upgrade | Catmull-Rom ribbon engine; reuse `trail-mesh.ts` constants for taper/fade parity |
| `effects/trails/TrailMaterial3D.ts` | keep + upgrade | Shader: HDR emissive, `edge_t` halo falloff, additive blend, head→tail alpha |
| `effects/trails/RibbonTrail3D.svelte` | DELETE | Verlet rope — wrong model |
| `effects/trails/TrailRenderer.svelte` | DELETE | TubeGeometry — unused |
| `effects/EffectsLayer.svelte` | edit | Remove the 4× `RibbonTrail3D` mounts (so the deleted import resolves); if `EffectsLayer` is fully dead after that, flag — do not expand scope to delete it here |
| `effects/post-processing/ScenePostProcessing.svelte` | edit | Extend `shouldCompose` to tier-gated, scene-agnostic bloom; minimal non-ocean pass chain |
| `components/Viewer3DScene.svelte` | edit | Provide `effectsSlot` → `EffectOrchestrator3D` to `PerformerRig` |
| `features/coven-hub/components/CovenStation.svelte` | edit | Provide `effectsSlot` → `EffectOrchestrator3D` to `PerformerRig` |

## Out of scope

- The `EffectsLayer` vs `EffectOrchestrator3D` duplication (both are effect orchestrators; only trails are in scope here). Flag, do not resolve.
- Other effects (fire, sparkles, zap, echo, bloom-as-effect, water, bubbles, petals, smoke).
- The 2D trail pipeline — untouched; it is the parity reference, not a target.

## Verification

- Visual: open the sequence viewer 3D pane (or `/coven`) with a sequence playing; the prop tips leave a glowing, tapering, fading trail that reads like the 2D animation canvas. Screenshot.
- Tier: force LOW tier (localStorage override `tka-3d-quality-tier-override`) → trail still shows the shader halo, no bloom. Force HIGH → bloom haze appears.
- Coven: with the current maximum formation (6 center rigs plus 6 optional acolytes), the trail renders without the GPU-starvation render-timeout flood.

## Revalidation (2026-07-29)

The main implementation landed but this spec never moved out of the active queue:

- `a8f2a4af6c` consolidated the renderer, added the halo and tier-gated bloom, wired the viewer and Coven slots, deleted the competing implementations, and recorded live `/coven` trail proof.
- `b4cd826dc9` added per-performer effect routing and adaptive Catmull-Rom subdivisions.
- `674c254d49` stitched the ribbon with an index buffer.
- `fc538455ed` made trail tuning apply live.

Current source confirms one Catmull-Rom trail implementation, shared `FADE_EXPONENT` and `MIN_TAIL_WIDTH_RATIO` constants, indexed ribbon geometry, an additive Gaussian halo, HIGH/MEDIUM bloom, LOW-tier shader glow, and live `effectsSlot` wiring in both consumers. Focused verification passed 17 tests across `trail-ring-buffer.test.ts` and `trail-mesh.test.ts`.

One approved behavior is still absent: `Trail3D.svelte` mounts and unmounts its mesh immediately when `enabled` changes. It does not apply the specified 300 ms entrance and 200 ms exit opacity envelope. LOW/HIGH comparison screenshots and a current-formation Coven performance check also remain unrecorded.

## Completion evidence (2026-07-29)

- `Trail3D.svelte` now keeps the ribbon mounted through a 300 ms entrance and 200 ms exit. The shared visibility manager owns the envelope, and the shader uniform applies it without discarding buffered trail geometry during exit.
- Focused Vitest verification passed 11 tests across `visibility-fade-clock-agnostic.test.ts` and `trail-ring-buffer.test.ts`.
- HIGH and LOW tier proof was captured with the shipping `PerformerRig`, `EffectOrchestrator3D`, `CovenStation`, and quality-tier override. The HIGH observation ran for 15.0 seconds with no new console errors or render timeouts. The LOW observation ran for 10.0 seconds with the same result.
- The proof scene rendered one viewer rig beside the maximum Coven formation of six center rigs and six acolytes. Screenshots are saved at `test-results/visual/3d-trail-envelope-high.png` and `test-results/visual/3d-trail-envelope-low.png`.
- The repository gate remains blocked. `pnpm run check` reported seven TypeScript errors, all in the unrelated in-flight `WorkspaceShareControl.svelte`; none were reported in the trail files changed here.
- The 2026-07-30 close-out rerun produced the same seven errors and five warnings. Every error was still confined to `WorkspaceShareControl.svelte`, so the queue dependency is now explicit instead of letting this blocked close-out outrank executable work.
