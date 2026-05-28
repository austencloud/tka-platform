import type { RenderContext } from "./RenderContextRegistry";
import type { IAnimationRenderer } from "$lib/shared/animation-engine/services/contracts/IAnimationRenderer";
import type { EffectRendererManager } from "./EffectRendererManager";
import type { TrailCapturer } from "./TrailCapturer";
import type { IAnimationRenderLoop } from "$lib/shared/animation-engine/services/contracts/IAnimationRenderLoop";
import type { CanvasResizer } from "./CanvasResizer.svelte";
import type { IAnimationPrecomputer } from "$lib/shared/animation-engine/services/contracts/IAnimationPrecomputer";

export interface RenderContextDeps {
  id: string;
  canvas: HTMLCanvasElement;
  container: HTMLDivElement;
  renderer: IAnimationRenderer;
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
  readonly renderer: IAnimationRenderer;
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
    this.precomputer.dispose();
    this.trailCapturer.clearTrails();
  }
}
