import type { IAnimationRenderer } from "$lib/shared/animation-engine/services/contracts/IAnimationRenderer";
import type { EffectRendererManager } from "./EffectRendererManager";
import type { TrailCapturer } from "./TrailCapturer";
import type { IAnimationRenderLoop } from "$lib/shared/animation-engine/services/contracts/IAnimationRenderLoop";
import type { CanvasResizer } from "./CanvasResizer.svelte";
import type { IAnimationPrecomputer } from "$lib/shared/animation-engine/services/contracts/IAnimationPrecomputer";

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
