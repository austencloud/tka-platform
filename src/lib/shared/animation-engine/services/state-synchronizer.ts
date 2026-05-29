import type { CanvasResizer } from "./canvas-resizer.svelte";
import type { EffectRendererManager } from "./effect-renderer-manager";
import type { TrailCapturer } from "./trail-capturer";
import type { IAnimationRenderLoop } from "$lib/shared/animation-engine/services/IAnimationRenderLoop";

export interface SyncServiceDeps {
  canvasResizerService: CanvasResizer | null;
  trailCapturer: TrailCapturer | null;
  renderLoopService: IAnimationRenderLoop | null;
  effectRendererManager: EffectRendererManager;
}

export class StateSynchronizer {
  private canvasSize: number = 500;

  syncResizeState(deps: SyncServiceDeps): number {
    if (deps.canvasResizerService) {
      const newSize = deps.canvasResizerService.state.currentSize;
      if (newSize && newSize !== this.canvasSize) {
        this.canvasSize = newSize;
        deps.trailCapturer?.updateConfig({ canvasSize: newSize });
        deps.renderLoopService?.updateConfig({ canvasSize: newSize });
        deps.effectRendererManager.resizeAll(newSize);
      }
    }
    return this.canvasSize;
  }

  getCanvasSize(): number {
    return this.canvasSize;
  }

  setCanvasSize(size: number): void {
    this.canvasSize = size;
  }
}
