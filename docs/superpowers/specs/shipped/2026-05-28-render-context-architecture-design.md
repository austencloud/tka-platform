# Render Context Architecture

**Date:** 2026-05-28  
**Status:** Draft  
**Scope:** Clean-room redesign of the animation rendering infrastructure  
**Supersedes:** `2026-05-28-export-fidelity-and-share-design.md` Feature 1 (trail fidelity via callback hack). Feature 2 (mobile share sheet) remains valid and independent.

---

## Problem Statement

`AnimationEngine` is a 1593-line god class created per-component inside `AnimatorCanvas.svelte:268`. It owns canvas lifecycle, effect rendering, state synchronization, prop management, frame building, glyph transitions, and diagnostics. No service-layer code can reach any of this — export, pre-rendering, and thumbnail generation all need architectural workarounds.

**Concrete consequences:**
1. Export pipeline can't resize overlay canvases to output resolution → trail glow effects degrade in exported MP4s (the export fidelity bug)
2. No offscreen rendering capability → export captures from the live canvas, coupling viewport resolution to output quality
3. Adding any cross-cutting concern that touches rendering requires adding callbacks to `VideoExportOrchestratorOptions` or querying DOM via `canvas.parentElement`
4. 1593 lines of mixed responsibilities → hard to test, hard to reason about, changes risk regressions across unrelated concerns

**Multi-instance reality:** Disassemble creates 3 engines, split view creates 2, inline players create N, effects lab creates 1. A singleton replacement won't work — the design must support multiple independent rendering contexts.

---

## Design

### Core Abstraction: `RenderContext`

A structured container for everything needed to render an animation canvas. Each canvas instance gets its own `RenderContext`. This is a plain object, not a god class — it holds references to focused services, not logic.

```typescript
interface RenderContext {
  readonly id: string;
  readonly canvas: HTMLCanvasElement;
  readonly container: HTMLDivElement;
  readonly renderer: AnimationRenderer;
  readonly effectManager: EffectRendererManager;
  readonly trailCapturer: TrailCapturer;
  readonly renderLoop: IAnimationRenderLoop;
  readonly resizer: CanvasResizer;
  readonly precomputer: IAnimationPrecomputer;

  size: number;

  resize(size: number): void;
  restoreSize(): void;
  triggerRender(): void;
  dispose(): void;
}
```

**What stays outside `RenderContext`:**
- `SequenceAnimationOrchestrator` — stateless computation, stays singleton via `getSequenceAnimationOrchestrator()`
- `PropInterpolator` — stateless, stays singleton
- `AnimationPlaybackController` — playback state, stays singleton, drives all contexts
- `AnimationVisibilityStateManager` — UI state, stays singleton or per-instance override

### Service Layer: Factory + Registry

**`RenderContextFactory`** — creates fully wired `RenderContext` instances. Replaces the ~500 lines of initialization code currently in `AnimationEngine.initialize()`, `initializeCanvas()`, `loadAnimatorServices()`, `initializeResizeService()`, `initializeRenderLoopService()`.

```typescript
interface RenderContextFactory {
  createLiveContext(
    container: HTMLDivElement,
    options?: {
      id?: string;
      visibilityManager?: AnimationVisibilityStateManager;
      effectsConfigState?: EffectsConfigState;
    }
  ): Promise<RenderContext>;

  createOffscreenContext(
    size: number,
    options?: { id?: string }
  ): Promise<RenderContext>;
}
```

`createOffscreenContext(1080)` creates a hidden DOM container (following existing `SequenceFramePreRenderer` pattern at lines 124-134), initializes a full rendering pipeline at the target resolution — `Canvas2DAnimationRenderer`, `EffectRendererManager` with all 16 overlay renderers, `TrailOverlayCanvas`, `TrailCapturer`, render loop. The export pipeline renders into this context. The live canvas is never touched.

**`RenderContextRegistry`** — tracks active contexts by ID. Exposed via `getRenderContextRegistry()` singleton getter.

```typescript
interface RenderContextRegistry {
  register(context: RenderContext): void;
  unregister(id: string): void;
  get(id: string): RenderContext | null;
  getAll(): RenderContext[];
}
```

Service-layer code reaches any rendering context:
```typescript
const ctx = getRenderContextRegistry().get("main");
ctx?.resize(1080);  // programmatic resize for export
```

### Decomposing AnimationEngine

The 1593-line `AnimationEngine` class splits into 5 focused units. Each receives a `RenderContext` reference and owns exactly one responsibility.

#### 1. `CanvasLifecycleManager` (~150 lines)

Owns canvas creation, DOM mounting, resize observation, and teardown.

**Absorbs from AnimationEngine:**
- `initializeCanvas()` (lines 1011-1063)
- `initializeResizeService()` (lines 1128-1136)
- `dispose()` (lines 903-948)
- `pauseResize()` / `resumeResize()` (lines 954-963)

**Interface:**
```typescript
class CanvasLifecycleManager {
  initialize(container: HTMLDivElement): Promise<void>;
  dispose(): void;
  pauseResize(): void;
  resumeResize(): void;
}
```

#### 2. `StateSynchronizer` (~300 lines)

Change detection and reactive state propagation. This is the core of the current `update()` method.

**Absorbs from AnimationEngine:**
- `update()` bulk (lines 520-770) — sequence change detection, grid mode changes, dark mode changes, trail settings sync, cache signal handling
- `syncServiceState()` (lines 1423-1500) — per-tick service state reads
- `handleVisibilityChange()` (lines 1236-1423) — visibility subscription handler
- All `prev*` change detection fields (lines 299-317)

**Interface:**
```typescript
class StateSynchronizer {
  update(props: AnimationEngineProps): void;
  onVisibilityChange(state: AnimationVisibilityState): void;
  dispose(): void;
}
```

#### 3. `FrameBuilder` (~200 lines)

Constructs render frame parameters. Mostly pure functions.

**Absorbs from AnimationEngine:**
- `buildFrameParams()` (currently delegated to `FrameParameterBuilder` but wiring is in `AnimationEngine`)
- `calculateBeatNumber()`, `calculateTurnsTuple()`, `calculateMusicalPosition()`
- Glyph transition state sync
- Trail capture integration for frame params

**Interface:**
```typescript
class FrameBuilder {
  build(props: AnimationEngineProps): FrameParameters;
}
```

#### 4. `PropPipeline` (~150 lines)

Prop type resolution, texture loading, SVG generation.

**Absorbs from AnimationEngine:**
- `PropTypeManager` wiring (lines 554-571)
- `initializePropTextureLoader()` (lines 1113-1126)
- `loadAnimatorServices()` SVG generator + trail capturer init (lines 1065-1097)
- Prop type change handling in `update()`

**Interface:**
```typescript
class PropPipeline {
  initialize(renderer: AnimationRenderer, svgGenerator: SVGGenerator): void;
  handlePropTypeChange(props: AnimationEngineProps, state: AnimationEngineState): void;
  loadTextures(darkMode: boolean): Promise<void>;
  dispose(): void;
}
```

#### 5. `EffectController` (~100 lines from AnimationEngine, wraps existing EffectRendererManager)

Promoted from passthrough methods on `AnimationEngine` to first-class unit. `EffectRendererManager` (already well-extracted at 562 lines) becomes the implementation detail.

**Absorbs from AnimationEngine:**
- `setFireConfig()`, `getFireConfig()`, `setLedConfig()`, `getLedConfig()` (lines 968-991)
- `setCellTipEffectMap()`, `setCellTipEffortMap()` (lines 996-1005)
- `invalidateFireCache()`, `invalidateFireFrameCacheOnly()`, `clearFireThermalFields()` (lines 817-837)
- `captureEffectDiagnostics()` (lines 863-898)
- All diagnostic methods (lines 839-856)

**Interface:**
```typescript
class EffectController {
  setFireConfig(config: Partial<FireOverlayConfig>): void;
  setLedConfig(config: Partial<LedOverlayConfig>): void;
  invalidateFireCache(): void;
  captureDiagnostics(): Record<string, unknown>;
  dispose(): void;
}
```

### What `AnimatorCanvas.svelte` Becomes

The component becomes a thin shell:

1. Calls `renderContextFactory.createLiveContext(container)` on mount
2. Registers context in `RenderContextRegistry`
3. Creates `StateSynchronizer`, `FrameBuilder`, `PropPipeline`, `EffectController` — all receiving the `RenderContext`
4. Single `$effect` calls `stateSynchronizer.update(props)` on prop changes
5. On destroy: `context.dispose()`, unregister from registry
6. Template: canvas wrapper div, `GlyphOverlay`, `ProgressOverlay` (unchanged)

### How Export Works After This Refactor

The `VideoExportOrchestrator` no longer needs callbacks, DOM queries, or resize hacks:

```typescript
async executeExport(canvas, playbackController, panelState, onProgress, options) {
  const factory = getRenderContextFactory();
  const exportCtx = await factory.createOffscreenContext(outputCanvasSize);

  try {
    // Render each frame into the offscreen context at native resolution
    for (const frame of frames) {
      playbackController.calculateStateForStep(position);
      exportCtx.triggerRender();
      await captureFrame(exportCtx.canvas);
    }
  } finally {
    exportCtx.dispose();
  }
}
```

Trail glow, fire fluid simulation, LED patterns — all render natively at 1080p/4K in the offscreen context. No upscaling. No live canvas interference. No restore step.

The `canvas` parameter to `executeExport()` becomes unnecessary for the render pipeline (it's still used to determine output aspect ratio and to read the current animation state). The signature can evolve in a future pass.

### Mobile Share Sheet

Independent of the architecture refactor. `downloadBlob()` in `file-downloader.ts` gains Web Share API support following the existing `Sharer.shareViaDevice()` pattern. This is a 1-file change and can ship separately.

---

## Migration Strategy

The refactor is incremental. At no point does the app break.

**Phase 1: Extract `RenderContext` + Factory + Registry.** Create the new abstractions. `RenderContextFactory.createLiveContext()` internally creates an `AnimationEngine` — the factory wraps the old code, not replaces it yet. Registry is wired. Export can use `createOffscreenContext()` immediately.

**Phase 2: Extract `CanvasLifecycleManager`.** Move init/dispose/resize code from `AnimationEngine` into the new class. `AnimationEngine` delegates to it. Line count drops ~150 lines.

**Phase 3: Extract `StateSynchronizer`.** Move `update()` bulk + `syncServiceState()` + change detection state. `AnimationEngine` delegates. Drops ~300 lines.

**Phase 4: Extract `FrameBuilder`.** Move frame parameter construction + glyph calculations. Drops ~200 lines.

**Phase 5: Extract `PropPipeline`.** Move prop type management + texture loading. Drops ~150 lines.

**Phase 6: Promote `EffectController`.** Move passthrough methods. Drops ~100 lines. `AnimationEngine` is now a thin coordinator of ~200 lines that creates and wires the 5 units — or dissolves entirely into `AnimatorCanvas.svelte`.

**Phase 7: Offscreen export pipeline.** `VideoExportOrchestrator` uses `createOffscreenContext()`. Trail fidelity bug is permanently eliminated.

**Phase 8: Mobile share sheet.** `downloadBlob()` gains Web Share API.

Each phase is a standalone commit that passes build + tests.

---

## What's NOT in scope

- Changing the singleton layer (`SequenceAnimationOrchestrator`, `AnimationPlaybackController`, `PropInterpolator`) — these are correctly factored
- Changing `EffectRendererManager` internals or the 16 overlay renderers — they're already well-extracted
- Changing the `Canvas2DAnimationRenderer` or `Canvas2DTrailRenderer` internals
- Rearchitecting `AnimatorCanvas.svelte`'s disassemble/split canvas logic (it becomes simpler naturally since each split canvas just creates its own `RenderContext`)
- Changing the WebCodecs/WASM video encoding pipeline

---

## Files Created

| File | Purpose |
|------|---------|
| `RenderContext.ts` | Interface + implementation |
| `RenderContextFactory.ts` | Creates live + offscreen contexts |
| `RenderContextRegistry.ts` | Singleton registry + `getRenderContextRegistry()` getter |
| `CanvasLifecycleManager.ts` | Canvas init/dispose/resize |
| `StateSynchronizer.ts` | Change detection + state propagation |
| `FrameBuilder.ts` | Frame parameter construction |
| `PropPipeline.ts` | Prop type + texture management |
| `EffectController.ts` | Effect config + diagnostics facade |

## Files Modified

| File | Change |
|------|---------|
| `AnimationEngine.svelte.ts` | Progressively hollowed out → delegates to extracted units → eventually ~200 line coordinator or dissolved |
| `AnimatorCanvas.svelte` | Uses factory + registry instead of `new AnimationEngine()` |
| `VideoExportOrchestrator.ts` | Uses `createOffscreenContext()` instead of capturing from live canvas |
| `video-export-types.ts` | Remove `onResizeForExport` / `onRestoreFromExport` callbacks (no longer needed) |
| `file-downloader.ts` | Add Web Share API support |

## Testing Plan

| Unit | Test Type | What's Verified |
|------|-----------|-----------------|
| `RenderContext` | Unit | `resize()` updates all services, `dispose()` tears down cleanly, `restoreSize()` reads container |
| `RenderContextFactory` | Unit | `createLiveContext()` returns wired context with correct canvas dimensions |
| `RenderContextFactory` | Unit | `createOffscreenContext(1080)` returns context with 1080×1080 canvas, no visible DOM element |
| `RenderContextRegistry` | Unit | register/get/unregister lifecycle, `get()` returns null after unregister |
| `CanvasLifecycleManager` | Unit | init creates canvas in container, dispose removes all children, pause/resume toggle observer |
| `StateSynchronizer` | Unit | Sequence change → orchestrator reinitialized, grid mode change → texture reload triggered |
| `FrameBuilder` | Unit | Given props + state → correct `FrameParameters` output (pure function) |
| `PropPipeline` | Unit | Prop type change → correct texture load calls |
| `EffectController` | Unit | `setFireConfig()` propagates to `EffectRendererManager`, diagnostics capture returns valid shape |
| Export integration | Integration | `createOffscreenContext(1080)` → render frame with trails → capture → verify 1080×1080 output with no upscale artifacts |
| Live canvas | Integration | After export via offscreen context, live canvas unchanged (no resize/restore) |
| Multi-instance | Integration | Two live contexts coexist, each renders independently, registry tracks both |
| `downloadBlob` | Unit | Web Share API available → `navigator.share()` called; unavailable → anchor download fallback |

---

## Success Criteria

1. Export a sequence with trails at 1080p via offscreen context. Trail glow, width, smoothness visually indistinguishable from live preview.
2. Live canvas unaffected during and after export — no resize flicker, no restore step.
3. `getRenderContextRegistry().get("main")` returns the active render context from any service-layer code.
4. `AnimationEngine` reduced from 1593 lines to <250 lines (coordinator) or dissolved entirely.
5. All 5 extracted units have passing unit tests.
6. Mobile video export opens native share sheet instead of direct download.
7. No visual regression in live playback, disassemble, split view, inline players, or effects lab.
8. Each migration phase is a standalone commit that passes `npm run check` + `npm run build`.
