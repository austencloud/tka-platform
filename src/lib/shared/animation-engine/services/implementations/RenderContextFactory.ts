import type { RenderContext } from "./RenderContextRegistry";
import { AnimationEngine } from "./AnimationEngine.svelte";

export interface OffscreenContextOptions {
  id?: string;
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
