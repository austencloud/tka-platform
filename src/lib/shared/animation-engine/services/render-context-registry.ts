import type { IAnimationRenderer } from "$lib/shared/animation-engine/services/IAnimationRenderer";
import type { EffectRendererManager } from "./effect-renderer-manager";
import type { TrailCapturer } from "./trail-capturer";
import type { IAnimationRenderLoop } from "$lib/shared/animation-engine/services/IAnimationRenderLoop";
import type { CanvasResizer } from "./canvas-resizer.svelte";
import type { IAnimationPrecomputer } from "$lib/shared/animation-engine/services/IAnimationPrecomputer";

export interface RenderContext {
  readonly id: string;
  readonly canvas: HTMLCanvasElement;
  readonly container: HTMLDivElement;
  readonly renderer: IAnimationRenderer;
  readonly effectManager: EffectRendererManager;
  readonly trailCapturer: TrailCapturer;
  readonly renderLoop: IAnimationRenderLoop;
  readonly resizer: CanvasResizer;
  readonly precomputer: IAnimationPrecomputer;

  size: number;

  resize(size: number): void;
  restoreSize(): void;
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
