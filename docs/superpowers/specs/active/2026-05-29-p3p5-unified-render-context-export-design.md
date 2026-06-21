# P3+P5: Unified Render-Context Construction + Offscreen Export — Design

**Date:** 2026-05-29
**Phase:** P3+P5 (merged) of the animation-engine re-architecture
**Status:** Design — pending implementation plan

---

## Goal

One construction authority for render contexts, and a video-export path that renders on its own offscreen engine instead of hijacking the live one. Deletes the load-bearing resize hack and the half-built/dead factory stubs.

---

## Current State (ground truth)

### Two construction paths
- **Live:** `CanvasSurface.svelte` does `new AnimationEngine()` → `engine.initialize(container, …)`. The engine's `CanvasLifecycleManager` builds the six services (renderer, EffectRendererManager, render loop, TrailCapturer, CanvasResizer, precomputer) and wires them; `FrameSystem.buildFrameParams(props, deps)` supplies per-frame params. `engine.getRenderContext(id, container)` wraps those services in a `LiveRenderContext` and registers it in `RenderContextRegistry`.
- **Offscreen (broken):** `RenderContextFactory.createOffscreenContext(size)` **re-imports and hand-wires the same six services itself** — a parallel construction path — and stubs `getFrameParams: () => ({} as any)`. With no `FrameSystem`, it cannot render a real beat. Zero callers.
- `RenderContextFactory.createLiveContext()` throws (stub).

### The export resize hack (load-bearing)
`video-export-orchestrator.ts` receives an `AnimationPlaybackController` by constructor injection (`:62`). Per frame it calls `playbackController.calculateStateForStep(pos)`, which:
1. syncs `currentStep`,
2. runs the position-calculation engine (`animationEngine.calculateState(step)` — distinct from the Canvas2D `AnimationEngine`),
3. writes computed prop states into `animationPanelState`.

The **live** viewer component observes `animationPanelState` reactively and feeds `engine.update(props)`; the live render loop paints the live canvas. The orchestrator then waits one rAF and reads pixels off the **live** canvas.

To get native-resolution sharpness, the orchestrator finds the live context in the registry by matching `canvas`, then `resizer.pauseObservation()` + `resize(outputCanvasSize)` (`:402-407`), and after export `restoreSize()` + `resizer.resumeObservation()` (`:659-661`). This disturbs the user's on-screen canvas during export and couples export to the live engine.

> Note: `onResizeForExport` / `onRestoreFromExport` callbacks do **not** exist in the codebase — the hack works directly through the registry + context. Nothing to delete there.

### Headless viability — proven
`AnimationEngine`, `CanvasLifecycleManager`, `FrameSystem`, and `animator-state` contain **zero** `$effect`/`$derived` — all imperative, driven by explicit method calls. A `new AnimationEngine()` runs fine outside a Svelte component; no effect-root wrapper needed.

---

## Decisions (locked)

1. **Factory delegates to a headless engine.** `createOffscreenContext` builds `new AnimationEngine()` on an offscreen container and returns it (the engine exposes `getRenderContext()` + the real update/playback API). No second construction path.
2. **`createLiveContext` is deleted.** CanvasSurface keeps its direct `new AnimationEngine()`. Unification = **AnimationEngine is the sole construction authority** (via `CanvasLifecycleManager`); the factory's offscreen method is just a headless-engine wrapper. One construction path, two entry points (component = live, factory = offscreen).
3. **Offscreen engine is fresh per export, disposed after.** No warm-state carryover, no stale config. The per-export warm-up (fire re-bake at native size, glyph re-raster) is the same cost the resize hack already pays today — just off the user's screen.

---

## Architecture

### Construction
`RenderContextFactory.createOffscreenContext(size, options?)`:
1. Create an offscreen `<div>` at `size × size`, positioned off-screen, appended to `document.body`.
2. `const engine = new AnimationEngine()`.
3. `await engine.initialize(container, { onCanvasReady, onTrailSettingsChange, onEffectError })`.
4. Return a handle exposing: the engine (for `update`/playback), `engine.getRenderContext(id, container)` (for `canvas`/`resizer`/`dispose`), and a `dispose()` that disposes the engine and removes the container.

The exact return shape (engine + context, or context with an `engine` field) is an implementation detail for the plan; the orchestrator needs both the engine's `update()` and the context's `canvas`.

### Export path (per-frame drive)
The offscreen engine has no reactive component chain, so the orchestrator drives it directly:

```
const offscreen = await factory.createOffscreenContext(outputCanvasSize);
// initial config (mirrors what CanvasSurface feeds once):
offscreen.engine.setEffectsConfigState(ecs);
offscreen.engine.setFireConfig(fireConfig); offscreen.engine.setLedConfig(ledConfig);
offscreen.engine.setCellTipEffectMap(...); offscreen.engine.setCellTipEffortMap(...);

for each frame at playbackPosition:
  playbackController.calculateStateForStep(playbackPosition);   // computes props into panelState
  const props = assembleEngineProps(panelState, exportConfig, virtualTime);
  offscreen.engine.update(props);                               // push directly into headless engine
  // one rAF (calculateStateForStep + update are synchronous; single rAF per current logic)
  await waitForAnimationFrame();
  frameCompositor.renderCanvasLayers(ctx, offscreen.canvas, ...);
  frameCompositor.renderOverlays(ctx, offscreen.canvas, ...);

offscreen.dispose();
```

`assembleEngineProps` gathers the full prop set the engine expects (blueProp, redProp, additionalLayers, gridVisible, gridMode, backgroundAlpha, letter, stepData, sequenceData, currentStep, isPlaying, trailSettings, prop types, virtualTime, showNonRadialPoints) from `animationPanelState` + the export config — the same data the live viewer component passes to `AnimatorCanvas` today.

Fire and trail accumulation reproduce because the offscreen engine is stepped frame-by-frame with `virtualTime` and `isPlaying` semantics, exactly as the live path advances (the live `AnimatorCanvas` already takes a `virtualTime` prop "used during video export").

---

## Dead-code purge

- `RenderContextFactory.createLiveContext` — delete (throwing stub).
- `RenderContextFactory.createOffscreenContext` — delete the hand-wired body (re-imports of the six services + `getFrameParams: () => ({})`); replace with delegation.
- `video-export-orchestrator.ts` — delete the resize hack (`:402-407` + `:659-661`) and the `liveContext` registry-lookup-by-canvas.
- `LiveRenderContext.triggerRender` — currently passes `() => ({} as any)`. After the resize hack is gone, confirm whether anything still calls `ctx.triggerRender`; if dead, remove it; if used, route it through `frameSystem.buildFrameParams` (the engine-owned context already has a real `FrameSystem`).

---

## Verification / parity gate

No feature flag, no compat shim (project rule). Sequence:
1. Build the offscreen path alongside the existing live+resize path.
2. Export one **fire + trail + glyph** sequence both ways; compare output frames for parity and sharpness. Offscreen at native size must be ≥ current quality.
3. Once parity is confirmed, delete the resize hack in the **same phase**.
4. User verifies a real export visually (frames cannot be self-verified).

Type/test gate: scoped `check:watch` during iteration, one full `npm run check` before commit; animator-state tests stay green.

---

## File change map

| File | Change |
|---|---|
| `services/implementations/RenderContextFactory.ts` | Rewrite `createOffscreenContext` to delegate to a headless `AnimationEngine`; delete `createLiveContext`. |
| `services/implementations/RenderContext.ts` | Resolve `LiveRenderContext.triggerRender` stub (remove if dead, else wire to FrameSystem). |
| `features/compose/services/video-export-orchestrator.ts` | Route export through `createOffscreenContext`; per-frame `engine.update(props)`; composite off offscreen canvas; `dispose()` after; delete resize hack + `liveContext` lookup. |
| `services/implementations/AnimationEngine.svelte.ts` | Confirm the offscreen-needed playback/update API (`update`, `setFireConfig`, `setLedConfig`, cell-tip setters, `setEffectsConfigState`) is public. Expose anything missing. |
| `CanvasSurface.svelte` / `AnimatorCanvas.svelte` | No export-resize callback plumbing exists; no change expected beyond confirmation. |

---

## Risks & mitigations

- **Headless effect-root:** none needed — core is imperative (proven by zero `$effect`/`$derived`).
- **Prop-assembly completeness:** the offscreen engine must receive the *full* prop set each frame. Mitigation: derive `assembleEngineProps` from the exact prop list the live viewer passes to `AnimatorCanvas`; the parity export catches any omission (missing prop = visibly wrong frame).
- **Fire/trail determinism:** fire sim may use RNG; export already re-bakes per run today, so a fresh offscreen sim is not a regression. Parity export confirms visual equivalence.
- **Native-resolution memory:** a native-size offscreen canvas + fire fields cost GPU memory; per-export dispose frees it immediately.

---

## Out of scope

- WebGPU migration, trails-perf unification (separate projects).
- Any change to the live render path beyond deleting the export coupling.
- Persistent/warm offscreen engine (explicitly rejected — fresh per export).
