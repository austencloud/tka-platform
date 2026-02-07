/**
 * Animation Render Loop Implementation
 *
 * Manages the requestAnimationFrame render loop for AnimatorCanvas.
 * Handles RAF scheduling, trail point gathering, and scene rendering.
 */

import type { IAnimationRenderer } from "$lib/features/compose/services/contracts/IAnimationRenderer";
import type { ITrailCapturer } from "$lib/features/compose/services/contracts/ITrailCapturer";
import type { TrailPoint, TrailSettings } from "../../domain/types/TrailTypes";
import { TrailMode } from "../../domain/types/TrailTypes";
import type { AnimationPathCache } from "$lib/features/compose/services/implementations/AnimationPathCache";
import type { IFrameBudgetMonitor } from "../contracts/IFrameBudgetMonitor";
import type {
  IAnimationRenderLoop,
  RenderLoopConfig,
  RenderFrameParams,
} from "../contracts/IAnimationRenderLoop";

export class AnimationRenderLoop implements IAnimationRenderLoop {
  private renderer: IAnimationRenderer | null = null;
  private TrailCapturer: ITrailCapturer | null = null;
  private pathCache: AnimationPathCache | null = null;
  private frameBudgetMonitor: IFrameBudgetMonitor | null = null;
  private canvasSize: number = 950;
  private rafId: number | null = null;
  private needsRender: boolean = false;
  private getFrameParamsCallback: (() => RenderFrameParams) | null = null;
  private isDisposed: boolean = false; // Prevent RAF from continuing after disposal

  // Loop detection for cache-based trail gathering
  // Tracks when the animation loops to prevent trail artifacts
  private previousStep: number = 0;
  private loopOccurredAtStep: number | null = null;

  // CRITICAL: Reusable arrays to prevent GC pressure on mobile
  // These are reused every frame instead of allocating new arrays
  private reusableBlueTrailPoints: TrailPoint[] = [];
  private reusableRedTrailPoints: TrailPoint[] = [];
  // Additional tunnel layer trail points (lazily populated)
  private reusableAdditionalLayerTrails: Array<{
    blue: TrailPoint[];
    red: TrailPoint[];
  }> = [];

  initialize(config: RenderLoopConfig): void {
    this.renderer = config.renderer;
    this.TrailCapturer = config.TrailCapturer;
    this.pathCache = config.pathCache;
    this.canvasSize = config.canvasSize;
    this.frameBudgetMonitor = config.frameBudgetMonitor ?? null;
  }

  updateConfig(config: Partial<RenderLoopConfig>): void {
    if (config.renderer !== undefined) this.renderer = config.renderer;
    if (config.TrailCapturer !== undefined)
      this.TrailCapturer = config.TrailCapturer;
    if (config.pathCache !== undefined) this.pathCache = config.pathCache;
    if (config.canvasSize !== undefined) this.canvasSize = config.canvasSize;
    if (config.frameBudgetMonitor !== undefined)
      this.frameBudgetMonitor = config.frameBudgetMonitor ?? null;
  }

  start(getFrameParams: () => RenderFrameParams): void {
    this.getFrameParamsCallback = getFrameParams;
    if (this.rafId === null && this.renderer) {
      this.rafId = requestAnimationFrame(this.renderLoop);
    }
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.getFrameParamsCallback = null;
    // Reset loop tracking on stop
    this.previousStep = 0;
    this.loopOccurredAtStep = null;
  }

  isRunning(): boolean {
    return this.rafId !== null;
  }

  renderFrame(params: RenderFrameParams): void {
    if (!this.renderer) return;
    this.render(params, performance.now());
  }

  triggerRender(getFrameParams: () => RenderFrameParams): void {
    this.needsRender = true;
    this.getFrameParamsCallback = getFrameParams;
    if (this.rafId === null && this.renderer) {
      this.rafId = requestAnimationFrame(this.renderLoop);
    }
  }

  dispose(): void {
    // Mark as disposed FIRST to stop any pending RAF callbacks
    this.isDisposed = true;
    this.stop();
    this.renderer = null;
    this.TrailCapturer = null;
    this.pathCache = null;
    this.frameBudgetMonitor = null;
    this.getFrameParamsCallback = null;
    // Clear reusable arrays to free memory
    this.reusableBlueTrailPoints.length = 0;
    this.reusableRedTrailPoints.length = 0;
    this.reusableAdditionalLayerTrails.length = 0;
  }

  private renderLoop = (currentTime: number): void => {
    // CRITICAL: Check disposed flag first to prevent memory leaks
    if (this.isDisposed) {
      this.rafId = null;
      return;
    }

    if (!this.renderer || !this.getFrameParamsCallback) {
      this.rafId = null;
      return;
    }

    const params = this.getFrameParamsCallback();
    const { trailSettings, isPlaying } = params;

    // Real-time trail capture
    if (
      trailSettings.enabled &&
      trailSettings.mode !== TrailMode.OFF &&
      this.TrailCapturer
    ) {
      const currentStep =
        params.stepData && "stepNumber" in params.stepData
          ? params.stepData.stepNumber
          : undefined;
      this.TrailCapturer.captureFrame(
        {
          blueProp: params.props.blueProp,
          redProp: params.props.redProp,
          additionalLayers: params.props.additionalLayers.length > 0
            ? params.props.additionalLayers
            : undefined,
        },
        currentStep,
        currentTime
      );
    }

    // Continue render loop if:
    // 1. One-shot render is needed (needsRender)
    // 2. Trails are enabled and need continuous updates
    // 3. Animation is actively playing (props are interpolating)
    // 4. Background is transitioning (dark mode toggle animation)
    const trailsNeedContinuousRender =
      trailSettings.enabled && trailSettings.mode !== TrailMode.OFF;
    const backgroundTransitioning =
      this.renderer?.isBackgroundTransitioning() ?? false;
    const shouldContinueLoop =
      this.needsRender ||
      trailsNeedContinuousRender ||
      isPlaying ||
      backgroundTransitioning;

    if (shouldContinueLoop) {
      this.render(params, currentTime);
      this.needsRender = false;
      // Only schedule next frame if not disposed
      if (!this.isDisposed) {
        this.rafId = requestAnimationFrame(this.renderLoop);
      } else {
        this.rafId = null;
      }
    } else {
      // Stop loop when no render is needed
      this.rafId = null;
    }
  };

  private render(params: RenderFrameParams, currentTime: number): void {
    if (!this.renderer) return;

    // Frame budget monitoring: measure render time for adaptive quality
    const frameStart = this.frameBudgetMonitor?.beginFrame() ?? 0;

    const {
      stepData,
      currentStep,
      trailSettings,
      gridVisible,
      gridMode,
      letter,
      props,
      visibility,
    } = params;

    // Get turn tuple for glyph rendering
    const blueMotion = stepData?.motions?.blue;
    const redMotion = stepData?.motions?.red;
    const turnsTuple =
      blueMotion && redMotion ? `${blueMotion.turns}${redMotion.turns}` : null;

    // Gather trail points
    const trailPoints = this.gatherTrailPoints(currentStep, trailSettings);

    // Apply visibility settings
    const effectiveGridVisible = gridVisible && visibility.gridVisible;
    const effectivePropsVisible = visibility.propsVisible;
    const effectiveTrailsVisible =
      visibility.trailsVisible && trailSettings.enabled;

    // Derive motion visibility from both internal state AND whether prop is actually present
    // (props may be filtered to null by parent component based on its own visibility state)
    const effectiveBlueMotionVisible =
      visibility.blueMotionVisible && props.blueProp !== null;
    const effectiveRedMotionVisible =
      visibility.redMotionVisible && props.redProp !== null;

    // Build additional layer render data
    const additionalLayerRenderData = props.additionalLayers.map((layer, i) => {
      const layerTrails = trailPoints.additionalLayers[i];
      const colors = trailSettings.additionalLayerColors[i];
      return {
        blueProp: layer.blueProp,
        redProp: layer.redProp,
        blueTrailPoints:
          effectiveTrailsVisible && effectiveBlueMotionVisible && layerTrails
            ? layerTrails.blue
            : [],
        redTrailPoints:
          effectiveTrailsVisible && effectiveRedMotionVisible && layerTrails
            ? layerTrails.red
            : [],
        hasBlue: !!layer.blueProp && effectiveBlueMotionVisible,
        hasRed: !!layer.redProp && effectiveRedMotionVisible,
        blueColor: colors?.blue ?? "#8b5cf6",
        redColor: colors?.red ?? "#f97316",
      };
    });

    // Render scene
    // NOTE: Props are passed regardless of visibility so the renderer can fade them out.
    // The renderer's fade managers handle visibility transition animations for:
    // - Overall props toggle (propsFadeManager)
    // - Individual blue/red motion toggles (bluePropFadeManager, redPropFadeManager)
    this.renderer.renderScene({
      blueProp: props.blueProp,
      redProp: props.redProp,
      gridVisible: effectiveGridVisible,
      gridMode: gridMode?.toString() ?? null,
      letter: letter ?? null,
      turnsTuple,
      bluePropDimensions: props.bluePropDimensions,
      redPropDimensions: props.redPropDimensions,
      blueTrailPoints:
        effectiveTrailsVisible && effectiveBlueMotionVisible
          ? trailPoints.blue
          : [],
      redTrailPoints:
        effectiveTrailsVisible && effectiveRedMotionVisible
          ? trailPoints.red
          : [],
      additionalLayers:
        additionalLayerRenderData.length > 0
          ? additionalLayerRenderData
          : undefined,
      trailSettings,
      currentTime,
      visibility: {
        gridVisible: effectiveGridVisible,
        propsVisible: effectivePropsVisible,
        trailsVisible: effectiveTrailsVisible,
        blueMotionVisible: effectiveBlueMotionVisible,
        redMotionVisible: effectiveRedMotionVisible,
      },
      bluePropFlipped: params.bluePropFlipped ?? false,
      redPropFlipped: params.redPropFlipped ?? false,
      bluePropType: params.bluePropType,
      redPropType: params.redPropType,
      qualityHints: this.frameBudgetMonitor?.getQualityHints(),
    });

    // End frame budget measurement (updates rolling averages, may trigger tier change)
    if (this.frameBudgetMonitor) {
      this.frameBudgetMonitor.endFrame(frameStart);
    }
  }

  private gatherTrailPoints(
    currentStep: number,
    trailSettings: TrailSettings
  ): {
    blue: TrailPoint[];
    red: TrailPoint[];
    additionalLayers: Array<{ blue: TrailPoint[]; red: TrailPoint[] }>;
  } {
    // CRITICAL: Reuse arrays to prevent GC pressure on mobile
    // Clear arrays without deallocating (length = 0 keeps capacity)
    this.reusableBlueTrailPoints.length = 0;
    this.reusableRedTrailPoints.length = 0;

    // Detect animation loop (currentStep jumps backward significantly)
    // This happens when the sequence repeats from the beginning
    const LOOP_DETECTION_THRESHOLD = 0.5; // steps
    if (this.previousStep - currentStep > LOOP_DETECTION_THRESHOLD) {
      // Animation looped - record where the loop occurred
      this.loopOccurredAtStep = currentStep;
    }
    this.previousStep = currentStep;

    // Use cache for perfect gap-free trails (if available and valid)
    const usingCache = this.pathCache && this.pathCache.isValid() && currentStep !== null;
    if (usingCache && this.pathCache) {
      const scaleFactor = this.canvasSize / 950;

      // Calculate startStep based on trail mode
      // In FADE mode, we only want points within the fade duration window
      // Otherwise, start from 0 (show entire trail history)
      let startStep = 0;
      if (trailSettings.mode === TrailMode.FADE && trailSettings.fadeDurationMs > 0) {
        // Get cache info to calculate step duration
        const cacheInfo = this.pathCache.getCacheInfo();
        if (cacheInfo && cacheInfo.totalSteps > 0) {
          const stepDurationMs = cacheInfo.totalDurationMs / cacheInfo.totalSteps;
          // Calculate how many steps fit in the fade duration
          const fadeSteps = trailSettings.fadeDurationMs / stepDurationMs;
          // Start from currentStep minus fadeSteps (but not less than 0)
          startStep = Math.max(0, currentStep - fadeSteps);

          // CRITICAL FIX: When a loop has occurred, don't let startStep go before
          // the loop point. This prevents the renderer from drawing a line from
          // the fading tail back to the start position (where the sequence began).
          // The cache contains pre-computed points for steps 0 to totalSteps, but
          // after a loop, step 0 is "fresh" and shouldn't connect to old points.
          if (this.loopOccurredAtStep !== null) {
            // After a loop, the earliest point we should retrieve is the loop point
            // This ensures the trail only shows points captured since the loop
            startStep = Math.max(startStep, this.loopOccurredAtStep);
          }
        }
      }

      // Zero-allocation hot path: fill directly into reusable arrays
      // fillTrailPoints() reuses existing objects at each index, only allocating
      // when the array needs to grow (first few frames, then steady state = 0 allocs)

      // Blue prop trails (both left and right endpoints)
      let blueCount = this.pathCache.fillTrailPoints(
        0, 0, startStep, currentStep, scaleFactor,
        this.reusableBlueTrailPoints, 0
      );
      blueCount += this.pathCache.fillTrailPoints(
        0, 1, startStep, currentStep, scaleFactor,
        this.reusableBlueTrailPoints, blueCount
      );
      this.reusableBlueTrailPoints.length = blueCount;

      // Red prop trails (both left and right endpoints)
      let redCount = this.pathCache.fillTrailPoints(
        1, 0, startStep, currentStep, scaleFactor,
        this.reusableRedTrailPoints, 0
      );
      redCount += this.pathCache.fillTrailPoints(
        1, 1, startStep, currentStep, scaleFactor,
        this.reusableRedTrailPoints, redCount
      );
      this.reusableRedTrailPoints.length = redCount;
    } else if (this.TrailCapturer) {
      // Fallback to real-time capture - use zero-allocation fill method
      this.TrailCapturer.fillTrailPointArrays(
        this.reusableBlueTrailPoints,
        this.reusableRedTrailPoints,
        this.reusableAdditionalLayerTrails
      );
    }

    return {
      blue: this.reusableBlueTrailPoints,
      red: this.reusableRedTrailPoints,
      additionalLayers: this.reusableAdditionalLayerTrails,
    };
  }
}
