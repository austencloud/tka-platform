---
status: active
value: 3
effort: M
remaining: "Body status: Active"
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-07-25
---
# Fire-Switch Prewarm — Eliminate the WebGL-Effect Switch Freeze

**Date:** 2026-06-29
**Status:** Active
**Surface:** `/test/effect-tuner` (primary), production sequence viewer (secondary)

## Problem

Switching the active effect to **fire** (or any webgl-kind effect) freezes the
animated props for a brief fraction of a second. Reported on `/test/effect-tuner`
switching trails → fire.

## Root cause (from code)

Fire's shaders already compile asynchronously (`KHR_parallel_shader_compile` —
`web-gl-fire-renderer.ts` `kickoffProgramCompiles`/`pollShaderCompletion`), so
shader compile is NOT the stall on the live path.

The stall is the remaining **synchronous** init work, run inside the deferred-init
rAF in `EffectRendererManager.scheduleWebglInit` → `initOverlayRenderer`:

- `getContext("webgl2", …)` — new GPU context (expensive cold; cheaper once a
  webgl context already exists on the page, e.g. the trails overlay).
- `createSimulationBuffers()` — ~18 RGBA16F FBOs + a 4-level bloom mip chain.

The existing rAF deferral only **moves** the blocked frame from the click to the
next frame. It never removes it. That one ~100–150ms frame is the visible props
freeze.

Only **fire, led, trails** are `kind: "webgl"`. The other 13 overlays are
`canvas2d` (cheap `getContext` inline) and do not freeze. So the fix targets
webgl renderers only.

Render-loop gating (verified, `animation-render-loop.ts`): fire renders only when
`params.fireConfig != null && renderer.isInitialized()` AND `fireTips.length > 0`
(lines ~757, ~1135). Therefore a renderer that is **initialized but not assigned
in the tipEffectMap sits fully idle** — no simulation runs. This makes prewarming
safe.

## Goal

Top-tier smoothness on the tuner: **zero perceptible stutter** on any effect
switch. Pay the heavy GL init when nothing is animating (page load), not on the
switch frame. Keep production memory-light.

## Design (Tier 2: startup-warm + keep-warm, intent-prewarm for production)

### 1. Shared primitive — `prewarmRenderer(id)`

`EffectRendererManager.prewarmRenderer(id: OverlayEffectId)`: initialize a webgl
renderer (context + FBOs + kickoff compiles) WITHOUT flipping
`prevEffectEnabled`. No-op if already initialized or pending. Registers the
renderer into the render loop the same way `initOverlayRenderer` does; the loop
leaves it idle because no tips are assigned. `AnimationEngine.prewarmEffect(id)`
delegates to it.

### 2. Trigger A — startup warm (tuner)

New engine init option `prewarmEffects?: EffectType[]`. Threaded
AnimatorCanvas → CanvasSurface → AnimationEngine. Warmed during the engine's
async init **before the render loop free-runs**, so the cost lands in page load
where a dropped frame is invisible. The tuner passes the non-active webgl effects
(`["fire", "led"]`; trails is the default-active effect and inits normally).

### 3. Trigger B — hover intent (production viewer)

`EffectSelector` buttons fire `onpointerenter` + `onpointerdown` → a transient
`effectsConfigState.requestPrewarm(id)` hint (NOT persisted, NOT in the config
schema — a sibling to `activeEffect`). A small `$effect` in `CanvasSurface`
(which owns the engine and already observes the effects config) reads the hint
and calls `engine.prewarmEffect(id)`. The hover-to-click gap (150–500ms) covers
the init. Production omits `prewarmEffects` so it only warms what the user
reaches for.

### 4. Keep-warm

`syncOverlay`'s disable branch stops disposing webgl renderers. On the
enabled→disabled transition for a webgl renderer:

- `renderer.clearSimulation()` — clears the visible framebuffer so stale fire
  from `preserveDrawingBuffer: true` does not linger.
- hide the renderer canvas (`display: none` via a `setVisible(false)` on the
  renderer, or the manager toggling `getCanvas().style.display`).
- KEEP the context / FBOs / programs.
- still run `plugin.onDisable?.(this)` (fire resets the shared tip tracker).

On re-enable: un-hide the canvas; no re-init. Canvas2d overlays keep the current
dispose-on-disable behavior (cheap to recreate; no benefit to holding them).

Full `dispose()` (engine teardown) unchanged — it disposes everything.

## Data flow

```
startup (tuner):
  tuner +page  -- prewarmEffects=["fire","led"] -->  AnimatorCanvas
    --> CanvasSurface --> AnimationEngine.initialize(... prewarmEffects)
      --> manager.prewarmRenderer("fire"), prewarmRenderer("led")   [before loop runs]

hover (production):
  EffectSelector pointerenter(id) --> EffectsPanel onPrewarm
    --> effectsConfigState.requestPrewarm(id)
      --> CanvasSurface $effect reads ecs.prewarmHint --> engine.prewarmEffect(id)
        --> manager.prewarmRenderer(id)

switch (both):
  click --> setActiveEffect --> tipEffectMap --> syncOverlay
    --> renderer already isInitialized() --> NO heavy work --> no freeze
```

## Error handling

- `prewarmRenderer` wraps init in try/catch (mirrors `scheduleWebglInit`); a
  failed prewarm deletes the renderer and logs — a later enable falls back to the
  normal deferred init path. No user-facing error for a failed *prewarm*.
- Prewarm is best-effort: if the engine is not yet initialized when a hover hint
  arrives, the call is a no-op (the renderer warms on first enable instead).

## Known limitation (flagged, not gated on)

`activeFireInstanceCount` (`web-gl-fire-renderer.ts`) increments at init and
decrements at cleanup. With keep-warm, a hidden-but-resident fire keeps the count
up, which feeds adaptive-Jacobi quality **only across multiple simultaneous fire
instances**. Single-surface tuner/viewer impact: none. Left as-is.

## Testing

- `effect-renderer-manager` unit test: `prewarmRenderer("fire")` initializes the
  renderer, `prevEffectEnabled.get("fire")` stays false, and a subsequent
  `syncEffectOverlay("fire")` after enabling does no second init.
- keep-warm test: enabling then disabling fire leaves `getRenderer("fire")`
  initialized (not disposed); a second enable reuses the same instance.

## Verification

DevTools performance trace on `/test/effect-tuner`, before vs after: a switch
trails → fire shows no long-task / no dropped frame. Requires the user's browser
(permission requested at that step).

## Files

| File | Change |
|---|---|
| `services/effect-renderer-manager.ts` | `prewarmRenderer`; keep-warm in `syncOverlay` disable branch |
| `services/animation-engine.svelte.ts` | `prewarmEffect`; `prewarmEffects` init option (warm before loop) |
| `services/fire/web-gl-fire-renderer.ts` + led renderer | optional `setVisible(bool)` for keep-warm hide |
| `state/effects-config-state.svelte.ts` | transient `prewarmHint` + `requestPrewarm(id)` |
| `components/CanvasSurface.svelte` | thread `prewarmEffects`; intent `$effect` → `prewarmEffect` |
| `components/AnimatorCanvas.svelte` | thread `prewarmEffects` prop |
| `components/effects-panel/EffectsPanel.svelte` | `onPrewarm` prop → poke `requestPrewarm` |
| `components/effects-panel/EffectSelector.svelte` | `onpointerenter`/`onpointerdown` → `onPrewarm` |
| `routes/test/effect-tuner/+page.svelte` | pass `prewarmEffects={["fire","led"]}` |
