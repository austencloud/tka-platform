import { LiveRenderContext } from "./RenderContext";
import type { RenderContext } from "./RenderContextRegistry";

export interface LiveContextOptions {
  id?: string;
}

export interface OffscreenContextOptions {
  id?: string;
}

export class RenderContextFactory {
  async createLiveContext(
    _container: HTMLDivElement,
    _options?: LiveContextOptions
  ): Promise<RenderContext> {
    throw new Error(
      "createLiveContext not yet wired. AnimatorCanvas still uses AnimationEngine directly."
    );
  }

  async createOffscreenContext(
    size: number,
    options?: OffscreenContextOptions
  ): Promise<RenderContext> {
    const id = options?.id ?? `offscreen-${Math.random().toString(36).slice(2, 8)}`;

    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.left = "-9999px";
    container.style.top = "-9999px";
    container.style.width = `${size}px`;
    container.style.height = `${size}px`;
    container.style.pointerEvents = "none";
    document.body.appendChild(container);

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
      import("$lib/shared/animation-engine/services/implementations/Canvas2DAnimationRenderer"),
      import("$lib/shared/animation-engine/services/implementations/EffectRendererManager"),
      import("$lib/shared/animation-engine/services/implementations/TrailCapturer"),
      import("$lib/shared/animation-engine/services/implementations/AnimationRenderLoop"),
      import("$lib/shared/animation-engine/services/implementations/AnimationPrecomputer.svelte"),
      import("$lib/shared/animation-engine/services/implementations/CanvasResizer.svelte"),
      import("$lib/shared/animation-engine/services/implementations/FireTipTracker"),
      import("$lib/shared/animation-engine/services/implementations/LedTipTracker"),
      import("$lib/shared/animation-engine/services/implementations/DeviceTierDetector"),
      import("$lib/shared/animation-engine/services/implementations/FrameBudgetMonitor"),
    ]);

    const renderer = new Canvas2DAnimationRenderer();
    await renderer.initialize(container, size);
    const canvas = renderer.getCanvas()!;

    const fireTipTracker = new FireTipTracker();
    const ledTipTracker = new LedTipTracker();

    const effectManager = new EffectRendererManager();
    effectManager.fireTipTracker = fireTipTracker;
    effectManager.ledTipTracker = ledTipTracker;

    const trailCapturer = new TrailCapturer();

    const deviceTier = new DeviceTierDetector().detect();
    const frameBudgetMonitor = new FrameBudgetMonitor(deviceTier);

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

    effectManager.wire({
      containerElement: container,
      canvasSize: size,
      renderLoopService: renderLoop,
      getFrameParams: () => ({} as any),
      getVM: () => undefined as any,
    });

    const trailOverlay = effectManager.createTrailOverlay();
    trailOverlay.initialize(container, size, size);
    effectManager.trailOverlay = trailOverlay;
    renderLoop.updateConfig({ renderers: { trails: trailOverlay as unknown as import("../effects/EffectRenderer").EffectRendererLike } });

    const resizer = new CanvasResizer();
    resizer.initialize(container, renderer);

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

    const originalDispose = ctx.dispose.bind(ctx);
    ctx.dispose = () => {
      originalDispose();
      container.remove();
    };

    return ctx;
  }
}
