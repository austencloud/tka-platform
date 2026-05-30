import type { RenderContext } from "./render-context-registry";
import { AnimationEngine } from "./animation-engine.svelte";
import type { EffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
import type { AnimationVisibilityStateManager } from "../state/animation-visibility-state.svelte";

export interface OffscreenContextOptions {
  id?: string;
  /** Visibility manager the headless engine reads visibility/effect state from.
   *  Without it the offscreen engine renders props but NO effects (trails/fire),
   *  because the effect system has no active-effect/tipEffectMap source. */
  visibilityManager?: AnimationVisibilityStateManager;
  /** Effects config (active effect + tipEffectMap) for the headless engine.
   *  Must carry the active effect (e.g. trails) or the trail/fire overlay is
   *  never rendered even though points are captured. */
  effectsConfigState?: EffectsConfigState | null;
}

/** Handle from createOffscreenContext: the headless engine, its render context,
 *  and a dispose that tears down both + removes the offscreen DOM node. */
export interface OffscreenContextHandle {
  engine: AnimationEngine;
  context: RenderContext;
  dispose(): void;
}

export class RenderContextFactory {
  async createOffscreenContext(
    size: number,
    options?: OffscreenContextOptions,
  ): Promise<OffscreenContextHandle> {
    const id = options?.id ?? `offscreen-${size}`;

    const container = document.createElement("div");
    container.setAttribute("data-offscreen-render", id);
    container.style.position = "absolute";
    container.style.left = "-9999px";
    container.style.top = "-9999px";
    container.style.width = `${size}px`;
    container.style.height = `${size}px`;
    container.style.pointerEvents = "none";
    document.body.appendChild(container);

    const engine = new AnimationEngine();
    // Seed the size BEFORE initialize so the canvas + overlays are created at
    // `size` from frame 0. Otherwise the engine boots at DEFAULT_CANVAS_SIZE and
    // the async ResizeObserver resizes it mid-export, wiping trail buffers and
    // upscaling early frames (the export-fidelity regression).
    engine.setInitialCanvasSize(size);
    // Wire visibility + effect config BEFORE initialize so the first-frame
    // render has the active effect (trails/fire) and the overlay actually draws.
    if (options?.visibilityManager) {
      engine.setVisibilityManager(options.visibilityManager);
    }
    if (options?.effectsConfigState !== undefined) {
      engine.setEffectsConfigState(options.effectsConfigState);
    }
    await engine.initialize(container, {});

    const context = engine.getRenderContext(id, container);
    if (!context) {
      engine.dispose();
      container.remove();
      throw new Error("createOffscreenContext: engine.getRenderContext returned null");
    }

    return {
      engine,
      context,
      dispose() {
        engine.dispose();
        container.remove();
      },
    };
  }
}
