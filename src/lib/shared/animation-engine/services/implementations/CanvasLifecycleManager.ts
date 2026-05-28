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

  dispose(callbacks?: {
    onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
    onInitialized?: (v: boolean) => void;
  }): void {
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
