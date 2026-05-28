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

  configure(deps: {
    resizer?: CanvasResizer;
    renderLoop?: IAnimationRenderLoop;
    effectManager?: EffectRendererManager;
    trailCapturer?: TrailCapturer;
    canvasInitializer?: AnimatorCanvasInitializer;
    precomputer?: IAnimationPrecomputer;
    visibilitySyncService?: AnimationVisibilitySynchronizer;
    glyphTransitionService?: GlyphTransitionController;
    sequenceCacheService?: SequenceCache;
    trailSettingsSyncService?: TrailSettingsSynchronizer;
    propTypeChangeService?: PropTypeChanger;
    glyphTextureService?: IGlyphTextureLoader;
    propTextureService?: IPropTextureLoader;
    unsubscribeVisibility?: () => void;
  }): void {
    if (deps.resizer !== undefined) this.resizer = deps.resizer;
    if (deps.renderLoop !== undefined) this.renderLoop = deps.renderLoop;
    if (deps.effectManager !== undefined) this.effectManager = deps.effectManager;
    if (deps.trailCapturer !== undefined) this.trailCapturer = deps.trailCapturer;
    if (deps.canvasInitializer !== undefined) this.canvasInitializer = deps.canvasInitializer;
    if (deps.precomputer !== undefined) this.precomputer = deps.precomputer;
    if (deps.visibilitySyncService !== undefined) this.visibilitySyncService = deps.visibilitySyncService;
    if (deps.glyphTransitionService !== undefined) this.glyphTransitionService = deps.glyphTransitionService;
    if (deps.sequenceCacheService !== undefined) this.sequenceCacheService = deps.sequenceCacheService;
    if (deps.trailSettingsSyncService !== undefined) this.trailSettingsSyncService = deps.trailSettingsSyncService;
    if (deps.propTypeChangeService !== undefined) this.propTypeChangeService = deps.propTypeChangeService;
    if (deps.glyphTextureService !== undefined) this.glyphTextureService = deps.glyphTextureService;
    if (deps.propTextureService !== undefined) this.propTextureService = deps.propTextureService;
    if (deps.unsubscribeVisibility !== undefined) this.unsubscribeVisibility = deps.unsubscribeVisibility;
  }

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
