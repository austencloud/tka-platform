# Render Context Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decompose the 1593-line AnimationEngine god class into 5 focused units unified by a RenderContext abstraction, with a factory + registry enabling offscreen export rendering that permanently eliminates the trail fidelity bug.

**Architecture:** RenderContext is a structured container holding references to all rendering services for a single canvas instance. RenderContextFactory creates live (DOM-mounted) and offscreen (export-resolution) contexts. RenderContextRegistry is a singleton that makes any rendering context reachable from the service layer. Five focused units (CanvasLifecycleManager, StateSynchronizer, FrameBuilder, PropPipeline, EffectController) replace the monolithic AnimationEngine class.

**Tech Stack:** Svelte 5 (runes), TypeScript, Canvas2D, Vitest (jsdom), WebCodecs (MP4), Web Share API

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `src/lib/shared/animation-engine/services/implementations/RenderContext.ts` | Interface + implementation class |
| `src/lib/shared/animation-engine/services/implementations/RenderContextFactory.ts` | Creates live + offscreen contexts |
| `src/lib/shared/animation-engine/services/implementations/RenderContextRegistry.ts` | Singleton registry |
| `src/lib/shared/animation-engine/getRenderContextFactory.ts` | Singleton getter for factory |
| `src/lib/shared/animation-engine/getRenderContextRegistry.ts` | Singleton getter for registry |
| `src/lib/shared/animation-engine/services/implementations/CanvasLifecycleManager.ts` | Canvas init/dispose/resize |
| `src/lib/shared/animation-engine/services/implementations/StateSynchronizer.ts` | Change detection + state propagation |
| `src/lib/shared/animation-engine/services/implementations/FrameBuilderService.ts` | Frame parameter construction (named to avoid collision with existing `FrameParameterBuilder`) |
| `src/lib/shared/animation-engine/services/implementations/PropPipeline.ts` | Prop type + texture management |
| `src/lib/shared/animation-engine/services/implementations/EffectController.ts` | Effect config + diagnostics facade |
| `tests/unit/animation-engine/render-context-registry.test.ts` | Registry unit tests |
| `tests/unit/animation-engine/render-context.test.ts` | RenderContext unit tests |
| `tests/unit/animation-engine/effect-controller.test.ts` | EffectController unit tests |
| `tests/unit/animation-engine/frame-builder-service.test.ts` | FrameBuilderService unit tests |
| `tests/unit/animation-engine/canvas-lifecycle-manager.test.ts` | CanvasLifecycleManager unit tests |
| `tests/unit/animation-engine/mobile-share.test.ts` | Web Share API unit tests |

### Modified Files

| File | Change |
|------|--------|
| `src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts` | Progressively hollowed — delegates to extracted units |
| `src/lib/shared/animation-engine/components/AnimatorCanvas.svelte` | Uses factory + registry instead of `new AnimationEngine()` |
| `src/lib/features/compose/services/implementations/VideoExportOrchestrator.ts` | Uses `createOffscreenContext()` for export |
| `src/lib/shared/foundation/services/file-downloader.ts` | Add Web Share API support |

---

## Phase 1: RenderContext + Factory + Registry

### Task 1: RenderContextRegistry — Interface and Tests

**Files:**
- Create: `src/lib/shared/animation-engine/services/implementations/RenderContextRegistry.ts`
- Create: `src/lib/shared/animation-engine/getRenderContextRegistry.ts`
- Create: `tests/unit/animation-engine/render-context-registry.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/unit/animation-engine/render-context-registry.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { RenderContextRegistry } from "$lib/shared/animation-engine/services/implementations/RenderContextRegistry";

function makeMockContext(id: string) {
  return {
    id,
    canvas: {} as HTMLCanvasElement,
    container: {} as HTMLDivElement,
    renderer: {} as any,
    effectManager: {} as any,
    trailCapturer: {} as any,
    renderLoop: {} as any,
    resizer: {} as any,
    precomputer: {} as any,
    size: 500,
    resize: () => {},
    restoreSize: () => {},
    triggerRender: () => {},
    dispose: () => {},
  };
}

describe("RenderContextRegistry", () => {
  let registry: RenderContextRegistry;

  beforeEach(() => {
    registry = new RenderContextRegistry();
  });

  it("returns null for unregistered id", () => {
    expect(registry.get("main")).toBeNull();
  });

  it("registers and retrieves a context by id", () => {
    const ctx = makeMockContext("main");
    registry.register(ctx);
    expect(registry.get("main")).toBe(ctx);
  });

  it("unregisters a context", () => {
    const ctx = makeMockContext("main");
    registry.register(ctx);
    registry.unregister("main");
    expect(registry.get("main")).toBeNull();
  });

  it("getAll returns all registered contexts", () => {
    const a = makeMockContext("a");
    const b = makeMockContext("b");
    registry.register(a);
    registry.register(b);
    expect(registry.getAll()).toHaveLength(2);
    expect(registry.getAll()).toContain(a);
    expect(registry.getAll()).toContain(b);
  });

  it("overwrites existing context with same id", () => {
    const first = makeMockContext("main");
    const second = makeMockContext("main");
    registry.register(first);
    registry.register(second);
    expect(registry.get("main")).toBe(second);
    expect(registry.getAll()).toHaveLength(1);
  });

  it("unregister is a no-op for unknown id", () => {
    expect(() => registry.unregister("ghost")).not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/animation-engine/render-context-registry.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write RenderContext interface and Registry implementation**

```typescript
// src/lib/shared/animation-engine/services/implementations/RenderContextRegistry.ts
import type { AnimationRenderer } from "$lib/shared/animation-engine/services/contracts/IAnimationRenderer";
import type { EffectRendererManager } from "./EffectRendererManager";
import type { TrailCapturer } from "./TrailCapturer";
import type { IAnimationRenderLoop } from "$lib/shared/animation-engine/services/contracts/IAnimationRenderLoop";
import type { CanvasResizer } from "./CanvasResizer.svelte";
import type { IAnimationPrecomputer } from "$lib/shared/animation-engine/services/contracts/IAnimationPrecomputer";

export interface RenderContext {
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

export class RenderContextRegistry {
  private contexts = new Map<string, RenderContext>();

  register(context: RenderContext): void {
    this.contexts.set(context.id, context);
  }

  unregister(id: string): void {
    this.contexts.delete(id);
  }

  get(id: string): RenderContext | null {
    return this.contexts.get(id) ?? null;
  }

  getAll(): RenderContext[] {
    return Array.from(this.contexts.values());
  }
}
```

```typescript
// src/lib/shared/animation-engine/getRenderContextRegistry.ts
import { RenderContextRegistry } from "./services/implementations/RenderContextRegistry";

let instance: RenderContextRegistry | null = null;
export function getRenderContextRegistry(): RenderContextRegistry {
  return instance ??= new RenderContextRegistry();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/animation-engine/render-context-registry.test.ts`
Expected: all 6 tests PASS

- [ ] **Step 5: Run full build to verify no regressions**

Run: `npm run check && npm run build`
Expected: PASS — new files don't affect existing code

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/animation-engine/services/implementations/RenderContextRegistry.ts src/lib/shared/animation-engine/getRenderContextRegistry.ts tests/unit/animation-engine/render-context-registry.test.ts
git commit -m "feat(animation): add RenderContextRegistry with singleton getter and tests"
```

---

### Task 2: RenderContext Implementation

**Files:**
- Create: `src/lib/shared/animation-engine/services/implementations/RenderContext.ts`
- Create: `tests/unit/animation-engine/render-context.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/unit/animation-engine/render-context.test.ts
import { describe, it, expect, vi } from "vitest";
import { LiveRenderContext } from "$lib/shared/animation-engine/services/implementations/RenderContext";

function makeDeps(overrides: Record<string, any> = {}) {
  return {
    id: "test",
    canvas: { width: 500, height: 500 } as unknown as HTMLCanvasElement,
    container: {
      getBoundingClientRect: () => ({ width: 500, height: 500 }),
    } as unknown as HTMLDivElement,
    renderer: { resize: vi.fn(), renderScene: vi.fn() } as any,
    effectManager: { resizeAll: vi.fn(), dispose: vi.fn() } as any,
    trailCapturer: { updateConfig: vi.fn(), clearTrails: vi.fn() } as any,
    renderLoop: {
      updateConfig: vi.fn(),
      triggerRender: vi.fn(),
      dispose: vi.fn(),
    } as any,
    resizer: {
      resize: vi.fn().mockResolvedValue(1080),
      resumeObservation: vi.fn(),
      pauseObservation: vi.fn(),
      dispose: vi.fn(),
    } as any,
    precomputer: { dispose: vi.fn() } as any,
    ...overrides,
  };
}

describe("LiveRenderContext", () => {
  it("exposes id and size from constructor", () => {
    const deps = makeDeps();
    const ctx = new LiveRenderContext(deps);
    expect(ctx.id).toBe("test");
    expect(ctx.size).toBe(500);
  });

  it("resize updates size and propagates to all services", () => {
    const deps = makeDeps();
    const ctx = new LiveRenderContext(deps);
    ctx.resize(1080);
    expect(ctx.size).toBe(1080);
    expect(deps.renderer.resize).toHaveBeenCalledWith(1080);
    expect(deps.effectManager.resizeAll).toHaveBeenCalledWith(1080);
    expect(deps.trailCapturer.updateConfig).toHaveBeenCalledWith({ canvasSize: 1080 });
    expect(deps.renderLoop.updateConfig).toHaveBeenCalledWith({ canvasSize: 1080 });
  });

  it("restoreSize reads container dimensions", () => {
    const deps = makeDeps();
    const ctx = new LiveRenderContext(deps);
    ctx.resize(1080);
    ctx.restoreSize();
    expect(ctx.size).toBe(500);
  });

  it("triggerRender delegates to renderLoop", () => {
    const deps = makeDeps();
    const ctx = new LiveRenderContext(deps);
    ctx.triggerRender();
    expect(deps.renderLoop.triggerRender).toHaveBeenCalled();
  });

  it("dispose tears down all services", () => {
    const deps = makeDeps();
    const ctx = new LiveRenderContext(deps);
    ctx.dispose();
    expect(deps.effectManager.dispose).toHaveBeenCalled();
    expect(deps.renderLoop.dispose).toHaveBeenCalled();
    expect(deps.trailCapturer.clearTrails).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/animation-engine/render-context.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write LiveRenderContext implementation**

```typescript
// src/lib/shared/animation-engine/services/implementations/RenderContext.ts
import type { RenderContext } from "./RenderContextRegistry";
import type { AnimationRenderer } from "$lib/shared/animation-engine/services/contracts/IAnimationRenderer";
import type { EffectRendererManager } from "./EffectRendererManager";
import type { TrailCapturer } from "./TrailCapturer";
import type { IAnimationRenderLoop } from "$lib/shared/animation-engine/services/contracts/IAnimationRenderLoop";
import type { CanvasResizer } from "./CanvasResizer.svelte";
import type { IAnimationPrecomputer } from "$lib/shared/animation-engine/services/contracts/IAnimationPrecomputer";

export interface RenderContextDeps {
  id: string;
  canvas: HTMLCanvasElement;
  container: HTMLDivElement;
  renderer: AnimationRenderer;
  effectManager: EffectRendererManager;
  trailCapturer: TrailCapturer;
  renderLoop: IAnimationRenderLoop;
  resizer: CanvasResizer;
  precomputer: IAnimationPrecomputer;
}

export class LiveRenderContext implements RenderContext {
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

  constructor(deps: RenderContextDeps) {
    this.id = deps.id;
    this.canvas = deps.canvas;
    this.container = deps.container;
    this.renderer = deps.renderer;
    this.effectManager = deps.effectManager;
    this.trailCapturer = deps.trailCapturer;
    this.renderLoop = deps.renderLoop;
    this.resizer = deps.resizer;
    this.precomputer = deps.precomputer;
    this.size = deps.canvas.width;
  }

  resize(newSize: number): void {
    this.size = newSize;
    this.renderer.resize(newSize);
    this.effectManager.resizeAll(newSize);
    this.trailCapturer.updateConfig({ canvasSize: newSize });
    this.renderLoop.updateConfig({ canvasSize: newSize });
  }

  restoreSize(): void {
    const rect = this.container.getBoundingClientRect();
    const containerSize = Math.min(rect.width || 500, rect.height || 500) || 500;
    this.resize(containerSize);
  }

  triggerRender(): void {
    this.renderLoop.triggerRender(() => ({} as any));
  }

  dispose(): void {
    this.effectManager.dispose();
    this.renderLoop.dispose();
    this.precomputer.dispose?.();
    this.trailCapturer.clearTrails();
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/animation-engine/render-context.test.ts`
Expected: all 5 tests PASS

- [ ] **Step 5: Run full build**

Run: `npm run check && npm run build`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/animation-engine/services/implementations/RenderContext.ts tests/unit/animation-engine/render-context.test.ts
git commit -m "feat(animation): add LiveRenderContext implementation with tests"
```

---

### Task 3: RenderContextFactory — Wrapping Existing AnimationEngine

This task creates the factory that wraps the existing `AnimationEngine` for live contexts. The factory delegates to `AnimationEngine` internally — no behavior changes yet. This is the bridge that lets `AnimatorCanvas.svelte` switch to the factory pattern without breaking anything.

**Files:**
- Create: `src/lib/shared/animation-engine/services/implementations/RenderContextFactory.ts`
- Create: `src/lib/shared/animation-engine/getRenderContextFactory.ts`

- [ ] **Step 1: Write the factory**

```typescript
// src/lib/shared/animation-engine/services/implementations/RenderContextFactory.ts
import { LiveRenderContext } from "./RenderContext";
import type { RenderContext } from "./RenderContextRegistry";
import type { AnimationVisibilityStateManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
import type { EffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";

export interface LiveContextOptions {
  id?: string;
  visibilityManager?: AnimationVisibilityStateManager;
  effectsConfigState?: EffectsConfigState;
}

export interface OffscreenContextOptions {
  id?: string;
}

export class RenderContextFactory {
  /**
   * Create a context backed by a visible DOM container.
   * In Phase 1 this wraps AnimationEngine internally.
   * Future phases will wire focused units directly.
   */
  async createLiveContext(
    _container: HTMLDivElement,
    _options?: LiveContextOptions
  ): Promise<RenderContext> {
    // Phase 1: stub — AnimatorCanvas.svelte continues using AnimationEngine
    // directly. This method exists so the interface is established and tested.
    // Full wiring happens when AnimatorCanvas migrates in Phase 6.
    throw new Error(
      "createLiveContext not yet wired. AnimatorCanvas still uses AnimationEngine directly."
    );
  }

  /**
   * Create a fully functional offscreen rendering context at the given size.
   * Hidden DOM container, no visible UI. For export pipelines.
   */
  async createOffscreenContext(
    size: number,
    options?: OffscreenContextOptions
  ): Promise<RenderContext> {
    const id = options?.id ?? `offscreen-${Math.random().toString(36).slice(2, 8)}`;

    // Create hidden DOM container (same pattern as SequenceFramePreRenderer)
    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.left = "-9999px";
    container.style.top = "-9999px";
    container.style.width = `${size}px`;
    container.style.height = `${size}px`;
    container.style.pointerEvents = "none";
    document.body.appendChild(container);

    // Dynamic imports to avoid pulling heavy modules at startup
    const [
      { Canvas2DAnimationRenderer },
      { EffectRendererManager },
      { TrailCapturer },
      { AnimationRenderLoop },
      { AnimationPrecomputer },
      { CanvasResizer },
      { FireTipTracker },
      { LedTipTracker },
      { DeviceTierDetector },
      { FrameBudgetMonitor },
    ] = await Promise.all([
      import("./Canvas2DAnimationRenderer"),
      import("./EffectRendererManager"),
      import("./TrailCapturer"),
      import("./AnimationRenderLoop"),
      import("./AnimationPrecomputer.svelte"),
      import("./CanvasResizer.svelte"),
      import("./FireTipTracker"),
      import("./LedTipTracker"),
      import("./DeviceTierDetector"),
      import("./FrameBudgetMonitor"),
    ]);

    // Initialize Canvas2D renderer
    const renderer = new Canvas2DAnimationRenderer();
    await renderer.initialize(container, size);

    const canvas = renderer.getCanvas()!;

    // Initialize effect renderer manager
    const effectManager = new EffectRendererManager();
    const fireTipTracker = new FireTipTracker();
    const ledTipTracker = new LedTipTracker();
    effectManager.fireTipTracker = fireTipTracker;
    effectManager.ledTipTracker = ledTipTracker;

    // Initialize trail capturer
    const trailCapturer = new TrailCapturer();

    // Initialize render loop
    const frameBudgetMonitor = new FrameBudgetMonitor(new DeviceTierDetector().detect());
    const renderLoop = new AnimationRenderLoop();
    renderLoop.initialize({
      renderer,
      TrailCapturer: trailCapturer,
      pathCache: null,
      canvasSize: size,
      frameBudgetMonitor,
      fireTipTracker,
      ledTipTracker,
    });

    // Wire effect manager with render loop
    effectManager.wire({
      containerElement: container,
      canvasSize: size,
      renderLoopService: renderLoop,
      getFrameParams: () => ({} as any),
      getVM: () => undefined as any,
    });

    // Create trail overlay
    effectManager.trailOverlay = effectManager.createTrailOverlay();
    effectManager.trailOverlay.initialize(container, size, size);
    renderLoop.updateConfig({ trailOverlay: effectManager.trailOverlay });

    // Canvas resizer (for offscreen, mostly a no-op but keeps interface consistent)
    const resizer = new CanvasResizer();
    resizer.initialize(container, renderer);

    // Precomputer
    const precomputer = new AnimationPrecomputer();

    const ctx = new LiveRenderContext({
      id,
      canvas,
      container,
      renderer,
      effectManager,
      trailCapturer,
      renderLoop,
      resizer,
      precomputer,
    });

    // Override dispose to also remove hidden container from DOM
    const originalDispose = ctx.dispose.bind(ctx);
    ctx.dispose = () => {
      originalDispose();
      container.remove();
    };

    return ctx;
  }
}
```

```typescript
// src/lib/shared/animation-engine/getRenderContextFactory.ts
import { RenderContextFactory } from "./services/implementations/RenderContextFactory";

let instance: RenderContextFactory | null = null;
export function getRenderContextFactory(): RenderContextFactory {
  return instance ??= new RenderContextFactory();
}
```

- [ ] **Step 2: Run full build to verify no regressions**

Run: `npm run check && npm run build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/animation-engine/services/implementations/RenderContextFactory.ts src/lib/shared/animation-engine/getRenderContextFactory.ts
git commit -m "feat(animation): add RenderContextFactory with offscreen context creation"
```

---

### Task 4: Wire Registry into AnimatorCanvas

Connect `AnimatorCanvas.svelte` to the registry so that service-layer code can discover existing render contexts. This is additive — the component still uses `AnimationEngine` internally, but now registers a `RenderContext` wrapper.

**Files:**
- Modify: `src/lib/shared/animation-engine/components/AnimatorCanvas.svelte`
- Modify: `src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts`

- [ ] **Step 1: Add `getRenderContext()` method to AnimationEngine**

This method exposes the engine's internal services as a `RenderContext`. Read `AnimationEngine.svelte.ts` and add this public method after the existing `captureEffectDiagnostics()` method (around line 898):

```typescript
getRenderContext(id: string, container: HTMLDivElement): RenderContext | null {
  const canvas = this.animationRenderer?.getCanvas();
  if (!canvas || !this.renderLoopService || !this.trailCapturer || !this.canvasResizerService) {
    return null;
  }

  return new LiveRenderContext({
    id,
    canvas,
    container,
    renderer: this.animationRenderer!,
    effectManager: this.effectRendererManager,
    trailCapturer: this.trailCapturer,
    renderLoop: this.renderLoopService,
    resizer: this.canvasResizerService,
    precomputer: this.precomputationService!,
  });
}
```

Add imports at the top of `AnimationEngine.svelte.ts`:
```typescript
import { LiveRenderContext } from "./RenderContext";
import type { RenderContext } from "./RenderContextRegistry";
```

- [ ] **Step 2: Wire registry in AnimatorCanvas.svelte**

Read `AnimatorCanvas.svelte` lines 626-645 (the initialization `$effect`). Modify to register/unregister with the registry. Add after the `engine.initialize()` call inside `untrack()`:

```typescript
import { getRenderContextRegistry } from "../getRenderContextRegistry";
```

Inside the initialization `$effect`, after `engine.initialize(el, { ... })`, add:

```typescript
// Register render context after initialization settles (next tick)
queueMicrotask(() => {
  const ctx = engine.getRenderContext(contextId, el);
  if (ctx) {
    getRenderContextRegistry().register(ctx);
  }
});
```

In the cleanup function, add before `engine.dispose()`:

```typescript
getRenderContextRegistry().unregister(contextId);
```

Where `contextId` is derived from the component's props. Add a new prop to `AnimatorCanvas.svelte`:

```typescript
/** Unique ID for this render context in the registry. Defaults to a random ID. */
contextId?: string;
```

Default it:

```typescript
const resolvedContextId = contextId ?? `canvas-${Math.random().toString(36).slice(2, 8)}`;
```

- [ ] **Step 3: Run build + typecheck**

Run: `npm run check && npm run build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts src/lib/shared/animation-engine/components/AnimatorCanvas.svelte
git commit -m "feat(animation): wire RenderContextRegistry into AnimatorCanvas"
```

---

## Phase 2: Extract CanvasLifecycleManager

### Task 5: CanvasLifecycleManager

Extract canvas init/dispose/resize from AnimationEngine into a focused class.

**Files:**
- Create: `src/lib/shared/animation-engine/services/implementations/CanvasLifecycleManager.ts`
- Create: `tests/unit/animation-engine/canvas-lifecycle-manager.test.ts`
- Modify: `src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/unit/animation-engine/canvas-lifecycle-manager.test.ts
import { describe, it, expect, vi } from "vitest";
import { CanvasLifecycleManager } from "$lib/shared/animation-engine/services/implementations/CanvasLifecycleManager";

describe("CanvasLifecycleManager", () => {
  it("pauseResize delegates to resizer", () => {
    const resizer = { pauseObservation: vi.fn(), resumeObservation: vi.fn() };
    const mgr = new CanvasLifecycleManager();
    mgr.setResizer(resizer as any);
    mgr.pauseResize();
    expect(resizer.pauseObservation).toHaveBeenCalled();
  });

  it("resumeResize delegates to resizer", () => {
    const resizer = { pauseObservation: vi.fn(), resumeObservation: vi.fn() };
    const mgr = new CanvasLifecycleManager();
    mgr.setResizer(resizer as any);
    mgr.resumeResize();
    expect(resizer.resumeObservation).toHaveBeenCalled();
  });

  it("dispose tears down resizer and render loop", () => {
    const resizer = { teardown: vi.fn(), dispose: vi.fn() };
    const renderLoop = { dispose: vi.fn() };
    const effectManager = { dispose: vi.fn() };
    const trailCapturer = { clearTrails: vi.fn() };
    const mgr = new CanvasLifecycleManager();
    mgr.setResizer(resizer as any);
    mgr.setRenderLoop(renderLoop as any);
    mgr.setEffectManager(effectManager as any);
    mgr.setTrailCapturer(trailCapturer as any);
    mgr.dispose();
    expect(resizer.teardown).toHaveBeenCalled();
    expect(renderLoop.dispose).toHaveBeenCalled();
    expect(effectManager.dispose).toHaveBeenCalled();
    expect(trailCapturer.clearTrails).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/animation-engine/canvas-lifecycle-manager.test.ts`
Expected: FAIL

- [ ] **Step 3: Write CanvasLifecycleManager**

Read `AnimationEngine.svelte.ts` lines 903-963 (dispose, pauseResize, resumeResize). Extract into:

```typescript
// src/lib/shared/animation-engine/services/implementations/CanvasLifecycleManager.ts
import type { CanvasResizer } from "./CanvasResizer.svelte";
import type { IAnimationRenderLoop } from "$lib/shared/animation-engine/services/contracts/IAnimationRenderLoop";
import type { EffectRendererManager } from "./EffectRendererManager";
import type { TrailCapturer } from "./TrailCapturer";
import type { AnimatorCanvasInitializer } from "./AnimatorCanvasInitializer";
import type { IAnimationPrecomputer } from "$lib/shared/animation-engine/services/contracts/IAnimationPrecomputer";
import type { AnimationVisibilitySynchronizer } from "./AnimationVisibilitySynchronizer";
import type { GlyphTransitionController } from "./GlyphTransitionController.svelte";
import type { SequenceCache } from "./SequenceCache.svelte";
import type { TrailSettingsSynchronizer } from "./TrailSettingsSynchronizer.svelte";
import type { PropTypeChanger } from "./PropTypeChanger.svelte";
import type { IGlyphTextureLoader } from "$lib/shared/animation-engine/services/contracts/IGlyphTextureLoader";
import type { IPropTextureLoader } from "$lib/shared/animation-engine/services/contracts/IPropTextureLoader";

export class CanvasLifecycleManager {
  private resizer: CanvasResizer | null = null;
  private renderLoop: IAnimationRenderLoop | null = null;
  private effectManager: EffectRendererManager | null = null;
  private trailCapturer: TrailCapturer | null = null;
  private canvasInitializer: AnimatorCanvasInitializer | null = null;
  private precomputer: IAnimationPrecomputer | null = null;
  private visibilitySyncService: AnimationVisibilitySynchronizer | null = null;
  private glyphTransitionService: GlyphTransitionController | null = null;
  private sequenceCacheService: SequenceCache | null = null;
  private trailSettingsSyncService: TrailSettingsSynchronizer | null = null;
  private propTypeChangeService: PropTypeChanger | null = null;
  private glyphTextureService: IGlyphTextureLoader | null = null;
  private propTextureService: IPropTextureLoader | null = null;
  private unsubscribeVisibility: (() => void) | null = null;

  setResizer(resizer: CanvasResizer): void { this.resizer = resizer; }
  setRenderLoop(loop: IAnimationRenderLoop): void { this.renderLoop = loop; }
  setEffectManager(mgr: EffectRendererManager): void { this.effectManager = mgr; }
  setTrailCapturer(tc: TrailCapturer): void { this.trailCapturer = tc; }
  setCanvasInitializer(ci: AnimatorCanvasInitializer): void { this.canvasInitializer = ci; }
  setPrecomputer(pc: IAnimationPrecomputer): void { this.precomputer = pc; }
  setVisibilitySyncService(svc: AnimationVisibilitySynchronizer): void { this.visibilitySyncService = svc; }
  setGlyphTransitionService(svc: GlyphTransitionController): void { this.glyphTransitionService = svc; }
  setSequenceCacheService(svc: SequenceCache): void { this.sequenceCacheService = svc; }
  setTrailSettingsSyncService(svc: TrailSettingsSynchronizer): void { this.trailSettingsSyncService = svc; }
  setPropTypeChangeService(svc: PropTypeChanger): void { this.propTypeChangeService = svc; }
  setGlyphTextureService(svc: IGlyphTextureLoader): void { this.glyphTextureService = svc; }
  setPropTextureService(svc: IPropTextureLoader): void { this.propTextureService = svc; }
  setUnsubscribeVisibility(fn: () => void): void { this.unsubscribeVisibility = fn; }

  pauseResize(): void {
    this.resizer?.pauseObservation();
  }

  resumeResize(): void {
    this.resizer?.resumeObservation();
  }

  dispose(callbacks?: { onCanvasReady?: (canvas: HTMLCanvasElement | null) => void; onInitialized?: (v: boolean) => void }): void {
    this.unsubscribeVisibility?.();
    this.visibilitySyncService?.dispose();
    this.glyphTransitionService?.dispose();
    this.sequenceCacheService?.dispose();
    this.trailSettingsSyncService?.dispose();
    this.propTypeChangeService?.dispose();
    this.renderLoop?.dispose();
    this.resizer?.teardown();
    this.glyphTextureService?.dispose?.();
    this.propTextureService?.dispose?.();
    this.precomputer?.dispose?.();
    this.effectManager?.dispose();
    this.trailCapturer?.clearTrails();

    if (this.canvasInitializer && callbacks) {
      this.canvasInitializer.destroy({
        onCanvasReady: (canvas) => callbacks.onCanvasReady?.(canvas),
        onInitialized: (initialized) => callbacks.onInitialized?.(initialized),
      });
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/animation-engine/canvas-lifecycle-manager.test.ts`
Expected: all 3 tests PASS

- [ ] **Step 5: Wire into AnimationEngine — delegate dispose/pauseResize/resumeResize**

Read `AnimationEngine.svelte.ts`. Add a private field:

```typescript
private readonly lifecycleManager = new CanvasLifecycleManager();
```

In `initialize()` (around line 500, after creating services), wire up the lifecycle manager:

```typescript
this.lifecycleManager.setCanvasInitializer(this.canvasInitializer);
this.lifecycleManager.setVisibilitySyncService(this.visibilitySyncService!);
this.lifecycleManager.setGlyphTransitionService(this.glyphTransitionService!);
this.lifecycleManager.setSequenceCacheService(this.sequenceCacheService!);
this.lifecycleManager.setTrailSettingsSyncService(this.trailSettingsSyncService!);
this.lifecycleManager.setPropTypeChangeService(this.propTypeChangeService!);
this.lifecycleManager.setUnsubscribeVisibility(this.unsubscribeVisibility!);
```

In `initializeRenderLoopService()` (after creating renderLoop and resizer), add:

```typescript
this.lifecycleManager.setRenderLoop(this.renderLoopService!);
this.lifecycleManager.setEffectManager(this.effectRendererManager);
this.lifecycleManager.setTrailCapturer(this.trailCapturer!);
```

In `initializeResizeService()`, add:

```typescript
this.lifecycleManager.setResizer(this.canvasResizerService!);
```

In texture loaders, add:

```typescript
this.lifecycleManager.setGlyphTextureService(this.glyphTextureService!);
this.lifecycleManager.setPropTextureService(this.propTextureService!);
```

In `initializePrecomputationService()`, add:

```typescript
this.lifecycleManager.setPrecomputer(this.precomputationService!);
```

Replace the `dispose()` method body with:

```typescript
dispose(): void {
  this.lifecycleManager.dispose({
    onCanvasReady: (canvas) => this.callbacks.onCanvasReady?.(canvas),
    onInitialized: (initialized) => { this.state.isInitialized = initialized; },
  });
  this.containerElement = null;
  this.lastPropsRef = null;
  this.prevStepData = null;
  this.prevSequenceData = null;
  this.frameParameterBuilder.resetHandPresenceCache();
}
```

Replace `pauseResize()` and `resumeResize()` with:

```typescript
pauseResize(): void { this.lifecycleManager.pauseResize(); }
resumeResize(): void { this.lifecycleManager.resumeResize(); }
```

- [ ] **Step 6: Run build + typecheck**

Run: `npm run check && npm run build`
Expected: PASS

- [ ] **Step 7: Run all animation-engine tests**

Run: `npx vitest run tests/unit/animation-engine/`
Expected: all tests PASS

- [ ] **Step 8: Commit**

```bash
git add src/lib/shared/animation-engine/services/implementations/CanvasLifecycleManager.ts src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts tests/unit/animation-engine/canvas-lifecycle-manager.test.ts
git commit -m "refactor(animation): extract CanvasLifecycleManager from AnimationEngine"
```

---

## Phase 3: Extract EffectController

Extracting EffectController before StateSynchronizer because it's simpler (pure passthrough methods) and establishes the pattern for subsequent extractions.

### Task 6: EffectController

**Files:**
- Create: `src/lib/shared/animation-engine/services/implementations/EffectController.ts`
- Create: `tests/unit/animation-engine/effect-controller.test.ts`
- Modify: `src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/unit/animation-engine/effect-controller.test.ts
import { describe, it, expect, vi } from "vitest";
import { EffectController } from "$lib/shared/animation-engine/services/implementations/EffectController";

function mockEffectManager() {
  return {
    setFireConfig: vi.fn(),
    getFireConfig: vi.fn().mockReturnValue({ intensity: 0.7 }),
    setLedConfig: vi.fn(),
    getLedConfig: vi.fn().mockReturnValue({ enabled: false }),
    setCellTipEffectMap: vi.fn(),
    setCellTipEffortMap: vi.fn(),
    fireRenderer: { clearSimulation: vi.fn(), invalidateFrameCache: vi.fn(), clearThermalFields: vi.fn() },
    charcoalRenderer: { clearSimulation: vi.fn() },
    ledRenderer: { resetExportState: vi.fn() },
    fireConfig: { intensity: 0.7 },
  } as any;
}

describe("EffectController", () => {
  it("setFireConfig delegates to manager", () => {
    const mgr = mockEffectManager();
    const ctrl = new EffectController(mgr);
    ctrl.setFireConfig({ intensity: 0.9 });
    expect(mgr.setFireConfig).toHaveBeenCalledWith({ intensity: 0.9 });
  });

  it("getFireConfig returns manager config", () => {
    const mgr = mockEffectManager();
    const ctrl = new EffectController(mgr);
    expect(ctrl.getFireConfig()).toEqual({ intensity: 0.7 });
  });

  it("invalidateFireCache clears fire + charcoal + LED", () => {
    const mgr = mockEffectManager();
    const ctrl = new EffectController(mgr);
    ctrl.invalidateFireCache();
    expect(mgr.fireRenderer.clearSimulation).toHaveBeenCalled();
    expect(mgr.charcoalRenderer.clearSimulation).toHaveBeenCalled();
    expect(mgr.ledRenderer.resetExportState).toHaveBeenCalled();
  });

  it("captureDiagnostics returns structured object", () => {
    const mgr = mockEffectManager();
    const ctrl = new EffectController(mgr);
    const diag = ctrl.captureDiagnostics({
      isInitialized: true,
      isPlaying: false,
      currentStep: 3,
      canvasSize: 500,
      instanceId: "test-1",
    });
    expect(diag.timestamp).toBeDefined();
    expect(diag.instanceId).toBe("test-1");
    expect(diag.engineState).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/animation-engine/effect-controller.test.ts`
Expected: FAIL

- [ ] **Step 3: Write EffectController**

Read `AnimationEngine.svelte.ts` lines 817-898 and 968-1005. Extract these methods:

```typescript
// src/lib/shared/animation-engine/services/implementations/EffectController.ts
import type { EffectRendererManager } from "./EffectRendererManager";
import type { FireOverlayConfig } from "$lib/shared/animation-engine/domain/types/FireOverlayConfig";
import type { LedOverlayConfig } from "$lib/shared/animation-engine/domain/types/LedOverlayConfig";
import type { TipEffectMap, TipEffortMap } from "$lib/shared/animation-engine/domain/types/TipEffectTypes";

export interface DiagnosticContext {
  isInitialized: boolean;
  isPlaying: boolean;
  currentStep: number;
  canvasSize: number;
  instanceId: string;
}

export class EffectController {
  constructor(private readonly effectManager: EffectRendererManager) {}

  setFireConfig(config: Partial<FireOverlayConfig>): void {
    this.effectManager.setFireConfig(config);
  }

  getFireConfig(): FireOverlayConfig {
    return this.effectManager.getFireConfig();
  }

  setLedConfig(config: Partial<LedOverlayConfig>): void {
    this.effectManager.setLedConfig(config);
  }

  getLedConfig(): LedOverlayConfig {
    return this.effectManager.getLedConfig();
  }

  setCellTipEffectMap(map: TipEffectMap | undefined): void {
    this.effectManager.setCellTipEffectMap(map);
  }

  setCellTipEffortMap(map: TipEffortMap | undefined): void {
    this.effectManager.setCellTipEffortMap(map);
  }

  invalidateFireCache(): void {
    this.effectManager.fireRenderer?.clearSimulation();
    this.effectManager.charcoalRenderer?.clearSimulation();
    this.effectManager.ledRenderer?.resetExportState();
  }

  invalidateFireFrameCacheOnly(): void {
    this.effectManager.fireRenderer?.invalidateFrameCache();
  }

  clearFireThermalFields(): void {
    this.effectManager.fireRenderer?.clearThermalFields();
    this.effectManager.charcoalRenderer?.clearSimulation();
    this.effectManager.ledRenderer?.resetExportState();
  }

  captureDiagnostics(context: DiagnosticContext): Record<string, unknown> {
    return {
      timestamp: new Date().toISOString(),
      performanceNow: performance.now(),
      instanceId: context.instanceId,
      engineState: {
        isInitialized: context.isInitialized,
        isPlaying: context.isPlaying,
        currentStep: context.currentStep,
        canvasSize: context.canvasSize,
      },
      fireConfig: this.effectManager.fireConfig,
    };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/animation-engine/effect-controller.test.ts`
Expected: all 4 tests PASS

- [ ] **Step 5: Wire into AnimationEngine — delegate effect methods**

In `AnimationEngine.svelte.ts`, add a private field after `effectRendererManager`:

```typescript
private effectController: EffectController | null = null;
```

In `initializeRenderLoopService()`, after `effectRendererManager.wire(...)`, add:

```typescript
this.effectController = new EffectController(this.effectRendererManager);
```

Replace the passthrough methods (`setFireConfig`, `getFireConfig`, `setLedConfig`, `getLedConfig`, `setCellTipEffectMap`, `setCellTipEffortMap`, `invalidateFireCache`, `invalidateFireFrameCacheOnly`, `clearFireThermalFields`) to delegate:

```typescript
setFireConfig(config: Partial<FireOverlayConfig>): void {
  this.effectController?.setFireConfig(config) ?? this.effectRendererManager.setFireConfig(config);
}
getFireConfig(): FireOverlayConfig {
  return this.effectController?.getFireConfig() ?? this.effectRendererManager.getFireConfig();
}
// ... same pattern for all other methods
```

Replace `captureEffectDiagnostics()` body to delegate to `effectController.captureDiagnostics()` while still including the additional visibility/sequence/prop data that the original method added (lines 864-898). The `EffectController.captureDiagnostics()` returns the core — `AnimationEngine` enriches it with context-specific fields.

- [ ] **Step 6: Run build + all tests**

Run: `npm run check && npm run build && npx vitest run tests/unit/animation-engine/`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/shared/animation-engine/services/implementations/EffectController.ts src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts tests/unit/animation-engine/effect-controller.test.ts
git commit -m "refactor(animation): extract EffectController from AnimationEngine"
```

---

## Phase 4: Extract FrameBuilderService

### Task 7: FrameBuilderService

**Files:**
- Create: `src/lib/shared/animation-engine/services/implementations/FrameBuilderService.ts`
- Create: `tests/unit/animation-engine/frame-builder-service.test.ts`
- Modify: `src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/unit/animation-engine/frame-builder-service.test.ts
import { describe, it, expect, vi } from "vitest";
import { FrameBuilderService } from "$lib/shared/animation-engine/services/implementations/FrameBuilderService";

describe("FrameBuilderService", () => {
  it("calculateBeatNumber returns 0 when no sequenceData", () => {
    const svc = new FrameBuilderService();
    const result = svc.calculateBeatNumber(null, null);
    expect(result).toBe(0);
  });

  it("calculateBeatNumber returns 1-based index when stepData found in sequence", () => {
    const step1 = { id: "s1" };
    const step2 = { id: "s2" };
    const sequenceData = { steps: [step1, step2] } as any;
    const svc = new FrameBuilderService();
    expect(svc.calculateBeatNumber(sequenceData, step2 as any)).toBe(2);
  });

  it("calculateBeatNumber returns 0 when stepData not in sequence", () => {
    const step1 = { id: "s1" };
    const orphan = { id: "orphan" };
    const sequenceData = { steps: [step1] } as any;
    const svc = new FrameBuilderService();
    expect(svc.calculateBeatNumber(sequenceData, orphan as any)).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/animation-engine/frame-builder-service.test.ts`
Expected: FAIL

- [ ] **Step 3: Write FrameBuilderService**

Read `AnimationEngine.svelte.ts` lines 1502-1592 (`calculateBeatNumber`, `calculateTurnsTuple`, `calculateMusicalPosition`, `buildFrameParams`). Extract the pure calculation methods:

```typescript
// src/lib/shared/animation-engine/services/implementations/FrameBuilderService.ts
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { StartPositionData, StepData } from "$lib/shared/foundation/domain/models/StepData";

export class FrameBuilderService {
  calculateBeatNumber(
    sequenceData: SequenceData | null,
    stepData: StartPositionData | StepData | null
  ): number {
    if (!sequenceData || !stepData) return 0;
    const stepIndex = sequenceData.steps?.findIndex((b) => b === stepData);
    if (stepIndex !== undefined && stepIndex >= 0) {
      return stepIndex + 1;
    }
    return 0;
  }

  calculateTurnsTuple(
    stepData: StartPositionData | StepData | null,
    sequenceData: SequenceData | null
  ): string {
    if (!stepData || !sequenceData) return "(s, 0, 0)";
    if ("blueMotion" in stepData && stepData.blueMotion && stepData.redMotion) {
      const blueTurns = stepData.blueMotion.turns ?? 0;
      const redTurns = stepData.redMotion.turns ?? 0;
      const propRotDir = stepData.blueMotion.propRotDir ?? "no_rot";
      const dirChar = propRotDir === "cw" ? "+" : propRotDir === "ccw" ? "-" : "s";
      return `(${dirChar}, ${blueTurns}, ${redTurns})`;
    }
    return "(s, 0, 0)";
  }

  calculateMusicalPosition(
    stepData: StartPositionData | StepData | null,
    sequenceData: SequenceData | null
  ): string | null {
    if (!sequenceData || !stepData) return null;
    const stepIndex = sequenceData.steps?.findIndex((b) => b === stepData);
    if (stepIndex === undefined || stepIndex < 0) return null;
    return `${stepIndex + 1}/${sequenceData.steps?.length ?? 0}`;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/animation-engine/frame-builder-service.test.ts`
Expected: all 3 tests PASS

- [ ] **Step 5: Wire into AnimationEngine — delegate calculation methods**

In `AnimationEngine.svelte.ts`, add:

```typescript
private readonly frameBuilderService = new FrameBuilderService();
```

Replace `calculateBeatNumber()`, `calculateTurnsTuple()`, `calculateMusicalPosition()` method bodies to delegate to `this.frameBuilderService`. The private method signatures stay — they just forward.

- [ ] **Step 6: Run build + tests**

Run: `npm run check && npm run build && npx vitest run tests/unit/animation-engine/`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/shared/animation-engine/services/implementations/FrameBuilderService.ts src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts tests/unit/animation-engine/frame-builder-service.test.ts
git commit -m "refactor(animation): extract FrameBuilderService from AnimationEngine"
```

---

## Phase 5: Extract StateSynchronizer and PropPipeline

These two are tightly coupled (prop changes happen during state sync), so they're extracted together. This is the largest extraction — the bulk of the `update()` method moves out.

### Task 8: StateSynchronizer + PropPipeline

This is a large task. Read `AnimationEngine.svelte.ts` lines 520-770 (`update()`) and 1423-1500 (`syncServiceState()`) carefully before implementing. The key challenge: these methods reference many private fields on `AnimationEngine`. The extracted class receives these as constructor dependencies or method parameters.

**Files:**
- Create: `src/lib/shared/animation-engine/services/implementations/StateSynchronizer.ts`
- Create: `src/lib/shared/animation-engine/services/implementations/PropPipeline.ts`
- Modify: `src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts`

- [ ] **Step 1: Create PropPipeline**

Read `AnimationEngine.svelte.ts` lines 554-571 (prop type handling in `update()`), lines 1065-1097 (`loadAnimatorServices()`), lines 1113-1126 (`initializePropTextureLoader()`). Extract:

```typescript
// src/lib/shared/animation-engine/services/implementations/PropPipeline.ts
import type { PropTypeManager } from "./PropTypeManager";
import type { AnimationEngineProps, AnimationEngineState } from "./AnimationEngine.svelte";
import type { AnimationRenderer } from "$lib/shared/animation-engine/services/contracts/IAnimationRenderer";
import type { SVGGenerator } from "../svg-generator";
import type { TrailCapturer } from "./TrailCapturer";
import type { IPropTextureLoader } from "$lib/shared/animation-engine/services/contracts/IPropTextureLoader";
import { PropTextureLoader } from "./PropTextureLoader.svelte";

export class PropPipeline {
  private propTextureService: IPropTextureLoader | null = null;

  constructor(
    private readonly propTypeManager: PropTypeManager,
  ) {}

  initializeTextureLoader(
    renderer: AnimationRenderer,
    svgGenerator: SVGGenerator,
    trailCapturer: TrailCapturer | null
  ): IPropTextureLoader {
    this.propTextureService = new PropTextureLoader();
    this.propTextureService.initialize(renderer, svgGenerator, trailCapturer);
    this.propTypeManager.updateRefs({ propTextureService: this.propTextureService });
    return this.propTextureService;
  }

  handlePropTypeChanges(
    props: AnimationEngineProps,
    state: AnimationEngineState,
    getFrameParamsFn: () => any,
    darkMode: boolean
  ): void {
    const hasOverrides = props.bluePropType != null || props.redPropType != null;

    if (hasOverrides) {
      this.propTypeManager.handleOverrides(props, state, getFrameParamsFn, darkMode);
    } else {
      this.propTypeManager.handleSettingsChange(state, getFrameParamsFn, darkMode);
    }

    this.propTypeManager.handleAdditionalLayers(props, state, getFrameParamsFn);
  }

  async loadTextures(state: AnimationEngineState, darkMode: boolean): Promise<void> {
    await this.propTypeManager.loadPropTextures(state, darkMode);
  }

  dispose(): void {
    this.propTextureService?.dispose?.();
  }
}
```

- [ ] **Step 2: Create StateSynchronizer stub**

The full `StateSynchronizer` extraction is complex. Start with a stub that delegates back to `AnimationEngine` — then incrementally move logic over. The first extraction moves `syncServiceState()`:

```typescript
// src/lib/shared/animation-engine/services/implementations/StateSynchronizer.ts
import type { CanvasResizer } from "./CanvasResizer.svelte";
import type { EffectRendererManager } from "./EffectRendererManager";
import type { TrailCapturer } from "./TrailCapturer";
import type { IAnimationRenderLoop } from "$lib/shared/animation-engine/services/contracts/IAnimationRenderLoop";
import type { AnimationEngineState } from "./AnimationEngine.svelte";

export interface SyncServiceDeps {
  canvasResizerService: CanvasResizer | null;
  trailCapturer: TrailCapturer | null;
  renderLoopService: IAnimationRenderLoop | null;
  effectRendererManager: EffectRendererManager;
}

export class StateSynchronizer {
  private canvasSize: number = 500;

  syncServiceState(
    deps: SyncServiceDeps,
    state: AnimationEngineState
  ): number {
    if (deps.canvasResizerService) {
      const newSize = deps.canvasResizerService.state.currentSize;
      if (newSize && newSize !== this.canvasSize) {
        this.canvasSize = newSize;
        deps.trailCapturer?.updateConfig({ canvasSize: newSize });
        deps.renderLoopService?.updateConfig({ canvasSize: newSize });
        deps.effectRendererManager.resizeAll(newSize);
      }
    }

    // Sync prop dimensions from renderer
    const pts = deps.renderLoopService?.getLastPropTransforms?.();
    if (pts?.blueDimensions && state.bluePropDimensions !== pts.blueDimensions) {
      state.bluePropDimensions = pts.blueDimensions;
    }
    if (pts?.redDimensions && state.redPropDimensions !== pts.redDimensions) {
      state.redPropDimensions = pts.redDimensions;
    }

    return this.canvasSize;
  }

  getCanvasSize(): number {
    return this.canvasSize;
  }

  setCanvasSize(size: number): void {
    this.canvasSize = size;
  }

  dispose(): void {
    // Future: clean up subscriptions moved here from AnimationEngine
  }
}
```

- [ ] **Step 3: Wire both into AnimationEngine**

In `AnimationEngine.svelte.ts`:

Add fields:
```typescript
private readonly propPipeline = new PropPipeline(this.propTypeManager);
private readonly stateSynchronizer = new StateSynchronizer();
```

In `syncServiceState()`, replace the canvas resize block (lines 1490-1498) with:
```typescript
this.canvasSize = this.stateSynchronizer.syncServiceState(
  {
    canvasResizerService: this.canvasResizerService,
    trailCapturer: this.trailCapturer,
    renderLoopService: this.renderLoopService,
    effectRendererManager: this.effectRendererManager,
  },
  this.state
);
```

In `update()`, replace the prop type handling block (lines 554-571) with:
```typescript
this.propPipeline.handlePropTypeChanges(
  props, this.state, getFrameParamsFn, this.prevDarkMode
);
```

- [ ] **Step 4: Run build + tests**

Run: `npm run check && npm run build && npx vitest run tests/unit/animation-engine/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/animation-engine/services/implementations/StateSynchronizer.ts src/lib/shared/animation-engine/services/implementations/PropPipeline.ts src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts
git commit -m "refactor(animation): extract StateSynchronizer and PropPipeline from AnimationEngine"
```

---

## Phase 6: Offscreen Export Pipeline

### Task 9: VideoExportOrchestrator uses createOffscreenContext

This is the payoff — the export pipeline renders at native resolution using an offscreen context. Trail fidelity bug eliminated.

**Files:**
- Modify: `src/lib/features/compose/services/implementations/VideoExportOrchestrator.ts`
- Modify: `src/lib/shared/animation-engine/services/implementations/RenderContextFactory.ts`

- [ ] **Step 1: Read the current export frame loop**

Read `VideoExportOrchestrator.ts` lines 375-600 to understand the current capture loop. Key sections:
- Lines 383-405: offscreen canvas creation at output resolution
- Lines 440-570: frame capture loop (calculateStateForStep → rAF → renderCanvasLayers → addFrame)
- Lines 580-600: blob creation and download

- [ ] **Step 2: Add offscreen context creation before capture loop**

In `VideoExportOrchestrator.executeExport()`, after the offscreen compositing canvas is created (line 403), add the offscreen render context creation:

```typescript
import { getRenderContextFactory } from "$lib/shared/animation-engine/getRenderContextFactory";

// Create offscreen render context at output resolution for native-quality effects
const factory = getRenderContextFactory();
let exportRenderContext: RenderContext | null = null;
try {
  exportRenderContext = await factory.createOffscreenContext(outputCanvasSize, {
    id: `export-${Date.now()}`,
  });
} catch (err) {
  console.warn("[VideoExport] Offscreen context creation failed, falling back to live canvas capture:", err);
}
```

- [ ] **Step 3: Modify frame capture to use offscreen context when available**

In the frame capture loop, before `compositor.renderCanvasLayers()`, add:

```typescript
// If offscreen context available, render frame there at native resolution
if (exportRenderContext) {
  // The playbackController already called calculateStateForStep above,
  // which updates the animation state. Now render that state into the
  // offscreen context.
  exportRenderContext.triggerRender();
  
  // Use the offscreen canvas as the source instead of the live canvas
  compositor.renderCanvasLayers(
    offscreenCtx,
    exportRenderContext.canvas,
    isCompositeMode,
    compositeStepIndex,
    offscreenCanvas,
    frameIndex
  );
} else {
  // Fallback: capture from live canvas (original behavior)
  compositor.renderCanvasLayers(
    offscreenCtx,
    canvas,
    isCompositeMode,
    compositeStepIndex,
    offscreenCanvas,
    frameIndex
  );
}
```

- [ ] **Step 4: Dispose offscreen context in finally block**

In the existing `finally` block (around line 580), add:

```typescript
exportRenderContext?.dispose();
```

- [ ] **Step 5: Verify the offscreen context's triggerRender uses correct frame params**

The `triggerRender()` on `LiveRenderContext` currently calls `renderLoop.triggerRender(() => ({} as any))` — this needs to be wired with actual frame params from the playback controller. Update `RenderContextFactory.createOffscreenContext()` to accept a `getFrameParams` callback:

In `RenderContextFactory.ts`, update the `createOffscreenContext` to store a `getFrameParams` setter:

```typescript
// After creating the renderLoop, update the triggerRender on the context
const ctx = new LiveRenderContext({ ... });
// The export orchestrator will set the frame params getter after creating the context
ctx.setFrameParamsGetter = (getter: () => RenderFrameParams) => {
  ctx.triggerRender = () => {
    renderLoop.renderFrame(getter());
  };
};
```

Back in `VideoExportOrchestrator`, after creating the offscreen context, wire the frame params:

```typescript
if (exportRenderContext && 'setFrameParamsGetter' in exportRenderContext) {
  (exportRenderContext as any).setFrameParamsGetter(() => {
    // Build frame params from current animation state
    return this.buildExportFrameParams(playbackController, panelState);
  });
}
```

**Note:** The exact frame params wiring depends on what `AnimationEngine.buildFrameParams()` produces. The export orchestrator needs to construct equivalent params. This is a known integration point — read the current `buildFrameParams` implementation and the `FrameParameterBuilder` to understand what data is needed. The implementation agent should trace this carefully.

- [ ] **Step 6: Run build + typecheck**

Run: `npm run check && npm run build`
Expected: PASS

- [ ] **Step 7: Manual verification**

Test the export on localhost:
1. Load a sequence with trails enabled
2. Export at 1080p
3. Compare trail quality in export vs live preview
4. Verify live canvas is unaffected after export

If no browser access: state explicitly "I cannot verify this visually. Please export a sequence with trails at 1080p and compare trail glow quality between the live preview and the exported MP4."

- [ ] **Step 8: Commit**

```bash
git add src/lib/features/compose/services/implementations/VideoExportOrchestrator.ts src/lib/shared/animation-engine/services/implementations/RenderContextFactory.ts src/lib/shared/animation-engine/services/implementations/RenderContext.ts
git commit -m "feat(export): use offscreen render context for native-resolution export"
```

---

## Phase 7: Mobile Share Sheet

### Task 10: Web Share API in downloadBlob

**Files:**
- Modify: `src/lib/shared/foundation/services/file-downloader.ts`
- Create: `tests/unit/animation-engine/mobile-share.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/unit/animation-engine/mobile-share.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { downloadBlob } from "$lib/shared/foundation/services/file-downloader";

describe("downloadBlob with Web Share API", () => {
  beforeEach(() => {
    // Reset navigator mocks
    vi.restoreAllMocks();
  });

  it("uses navigator.share when available and canShare returns true", async () => {
    const shareFn = vi.fn().mockResolvedValue(undefined);
    const canShareFn = vi.fn().mockReturnValue(true);

    Object.defineProperty(globalThis, "navigator", {
      value: { share: shareFn, canShare: canShareFn },
      writable: true,
      configurable: true,
    });

    const blob = new Blob(["video"], { type: "video/mp4" });
    const result = await downloadBlob(blob, "test.mp4");

    expect(canShareFn).toHaveBeenCalled();
    expect(shareFn).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it("falls back to anchor download when navigator.share is absent", async () => {
    Object.defineProperty(globalThis, "navigator", {
      value: {},
      writable: true,
      configurable: true,
    });

    // Mock anchor creation
    const clickFn = vi.fn();
    vi.spyOn(document, "createElement").mockReturnValue({
      set href(_: string) {},
      set download(_: string) {},
      style: {},
      click: clickFn,
    } as any);
    vi.spyOn(document.body, "appendChild").mockReturnValue({} as any);
    vi.spyOn(document.body, "removeChild").mockReturnValue({} as any);

    const blob = new Blob(["video"], { type: "video/mp4" });
    const result = await downloadBlob(blob, "test.mp4");

    expect(clickFn).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it("catches AbortError from dismissed share sheet", async () => {
    const abortError = new DOMException("Share canceled", "AbortError");
    const shareFn = vi.fn().mockRejectedValue(abortError);
    const canShareFn = vi.fn().mockReturnValue(true);

    Object.defineProperty(globalThis, "navigator", {
      value: { share: shareFn, canShare: canShareFn },
      writable: true,
      configurable: true,
    });

    const blob = new Blob(["video"], { type: "video/mp4" });
    const result = await downloadBlob(blob, "test.mp4");

    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/animation-engine/mobile-share.test.ts`
Expected: FAIL (downloadBlob doesn't use navigator.share yet)

- [ ] **Step 3: Update downloadBlob to try Web Share API first**

Read `file-downloader.ts` and read `Sharer.ts` lines 111-142 for the existing Web Share pattern. Update `downloadBlob`:

```typescript
export async function downloadBlob(
  blob: Blob,
  filename: string,
  _options: DownloadOptions = {}
): Promise<DownloadResult> {
  // Try Web Share API first (mobile native share sheet)
  if (navigator.share && navigator.canShare) {
    try {
      const file = new File([blob], filename, { type: blob.type });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
        return { success: true, filename };
      }
    } catch (error) {
      // AbortError = user dismissed share sheet — not an error
      if (error instanceof DOMException && error.name === "AbortError") {
        return { success: true, filename };
      }
      // Other errors: fall through to anchor download
    }
  }

  // Fallback: anchor download
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      resolve({ success: true, filename });
    } catch (error) {
      resolve({ success: false, filename, error: error as Error });
    }
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/animation-engine/mobile-share.test.ts`
Expected: all 3 tests PASS

- [ ] **Step 5: Run full build + all tests**

Run: `npm run check && npm run build && npx vitest run`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/foundation/services/file-downloader.ts tests/unit/animation-engine/mobile-share.test.ts
git commit -m "feat(export): add Web Share API support to downloadBlob for mobile share sheet"
```

---

## Final Verification

### Task 11: Full Integration Verification

- [ ] **Step 1: Run complete test suite**

Run: `npx vitest run`
Expected: all tests PASS

- [ ] **Step 2: Run typecheck + build**

Run: `npm run check && npm run build`
Expected: PASS, no type errors

- [ ] **Step 3: Verify AnimationEngine line reduction**

Run: `wc -l src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts`
Expected: measurably less than 1593 lines — target is <1300 after Phases 2-5 (full dissolution to <250 happens in a follow-up pass when AnimatorCanvas migrates to use factory directly)

- [ ] **Step 4: Verify all new files exist and are well-structured**

Run: `ls -la src/lib/shared/animation-engine/services/implementations/RenderContext*.ts src/lib/shared/animation-engine/services/implementations/CanvasLifecycleManager.ts src/lib/shared/animation-engine/services/implementations/EffectController.ts src/lib/shared/animation-engine/services/implementations/FrameBuilderService.ts src/lib/shared/animation-engine/services/implementations/StateSynchronizer.ts src/lib/shared/animation-engine/services/implementations/PropPipeline.ts`
Expected: all 8 files present

- [ ] **Step 5: Request visual verification from user**

State: "I cannot verify export quality visually. Please:
1. Export a sequence with trails at 1080p
2. Compare trail glow quality between live preview and exported MP4
3. On a mobile device, export a video and verify the native share sheet appears
4. Play a sequence normally after export — verify no visual regression"
