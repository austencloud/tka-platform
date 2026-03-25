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
import type { IFireOverlayRenderer } from "../contracts/IFireOverlayRenderer";
import type { ICharcoalRenderer } from "../contracts/ICharcoalRenderer";
import type { IFireTipTracker, FireTipTrackerConfig } from "../contracts/IFireTipTracker";
import type { ILedOverlayRenderer } from "../contracts/ILedOverlayRenderer";
import type { ILedTipTracker, LedTipTrackerConfig } from "../contracts/ILedTipTracker";
import type { ITrailOverlayCanvas } from "../contracts/ITrailOverlayCanvas";
import type {
  IAnimationRenderLoop,
  RenderLoopConfig,
  RenderFrameParams,
} from "../contracts/IAnimationRenderLoop";
import { QualityTier } from "../../domain/types/QualityTypes";

export class AnimationRenderLoop implements IAnimationRenderLoop {
  private renderer: IAnimationRenderer | null = null;
  private TrailCapturer: ITrailCapturer | null = null;
  private pathCache: AnimationPathCache | null = null;
  private frameBudgetMonitor: IFrameBudgetMonitor | null = null;
  private fireRenderer: IFireOverlayRenderer | null = null;
  private charcoalRenderer: ICharcoalRenderer | null = null;
  private fireTipTracker: IFireTipTracker | null = null;
  private ledRenderer: ILedOverlayRenderer | null = null;
  private ledTipTracker: ILedTipTracker | null = null;
  private trailOverlay: ITrailOverlayCanvas | null = null;
  private canvasSize: number = 950;
  private rafId: number | null = null;
  private needsRender: boolean = false;
  private getFrameParamsCallback: (() => RenderFrameParams) | null = null;
  private isDisposed: boolean = false; // Prevent RAF from continuing after disposal

  // Loop detection for cache-based trail gathering and fire frame cache
  // Tracks when the animation loops to prevent trail artifacts
  private previousStep: number = 0;
  private loopOccurredAtStep: number | null = null;
  /** True on the frame where a loop was detected. Reset each frame. */
  private loopDetectedThisFrame: boolean = false;
  /** True after the first loop has occurred. Prevents wrap-around on initial play. */
  private hasLoopedAtLeastOnce: boolean = false;
  /** Timestamp when the current loop started. Used for timestamp-indexed fire cache. */
  private loopStartTime: number = 0;

  // Track quality tier for fire adaptive quality
  private previousQualityTier: QualityTier | null = null;

  // Frame drop diagnostics — logs slow frames to console for debugging.
  // Disabled by default. Enable via browser console: window.__TKA_FRAME_DROP_LOG = true
  private frameDropLoggingEnabled = false;
  private static readonly FRAME_DROP_THRESHOLD_MS = 20; // ~50fps — anything below 60fps
  private lastFrameTime = 0; // Track RAF-to-RAF gap (true frame duration including browser overhead)
  private lastFrameDropLogTime = 0; // Rate-limit logs to avoid feedback loop with console recording extensions
  private static readonly FRAME_DROP_LOG_COOLDOWN_MS = 2000; // Max 1 log per 2 seconds
  private framesRenderedSinceStart = 0; // Warm-up grace period — skip frame drop logging for first N frames
  private static readonly WARMUP_FRAMES = 10; // First 10 frames always have high RAF gaps

  // Idle auto-stop: after N consecutive idle frames (not playing, no needsRender, no
  // effects active), stop the RAF loop. Prevents 16+ arrange grid cells from each
  // burning a permanent RAF loop just because trails are globally force-enabled.
  // triggerRender() restarts the loop whenever actual rendering is needed.
  private consecutiveIdleFrames = 0;
  private static readonly IDLE_STOP_THRESHOLD = 60; // ~1 second at 60fps

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
    this.fireRenderer = config.fireRenderer ?? null;
    this.charcoalRenderer = config.charcoalRenderer ?? null;
    this.fireTipTracker = config.fireTipTracker ?? null;
    this.ledRenderer = config.ledRenderer ?? null;
    this.ledTipTracker = config.ledTipTracker ?? null;
    this.trailOverlay = config.trailOverlay ?? null;
  }

  updateConfig(config: Partial<RenderLoopConfig>): void {
    if (config.renderer !== undefined) this.renderer = config.renderer;
    if (config.TrailCapturer !== undefined)
      this.TrailCapturer = config.TrailCapturer;
    if (config.pathCache !== undefined) this.pathCache = config.pathCache;
    if (config.canvasSize !== undefined) this.canvasSize = config.canvasSize;
    if (config.frameBudgetMonitor !== undefined)
      this.frameBudgetMonitor = config.frameBudgetMonitor ?? null;
    if (config.fireRenderer !== undefined)
      this.fireRenderer = config.fireRenderer ?? null;
    if (config.charcoalRenderer !== undefined)
      this.charcoalRenderer = config.charcoalRenderer ?? null;
    if (config.fireTipTracker !== undefined)
      this.fireTipTracker = config.fireTipTracker ?? null;
    if (config.ledRenderer !== undefined)
      this.ledRenderer = config.ledRenderer ?? null;
    if (config.ledTipTracker !== undefined)
      this.ledTipTracker = config.ledTipTracker ?? null;
    if (config.trailOverlay !== undefined)
      this.trailOverlay = config.trailOverlay ?? null;
  }

  start(getFrameParams: () => RenderFrameParams): void {
    this.getFrameParamsCallback = getFrameParams;
    this.framesRenderedSinceStart = 0;
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
    this.hasLoopedAtLeastOnce = false;
    this.loopStartTime = 0;
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
    this.consecutiveIdleFrames = 0; // Reset idle counter — new work incoming
    this.getFrameParamsCallback = getFrameParams;
    if (this.rafId === null && this.renderer) {
      this.framesRenderedSinceStart = 0; // Reset warm-up on loop restart
      this.rafId = requestAnimationFrame(this.renderLoop);
    }
  }

  setTargetFps(_fps: number | null): void {
    // No-op: FPS throttling removed — time-based animation interpolation
    // makes frame rate differences imperceptible in the preview.
    // FPS setting only affects the exported video file.
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
    // Clean up fire overlay
    this.fireRenderer?.dispose();
    this.fireRenderer = null;
    // Clean up charcoal overlay
    this.charcoalRenderer?.dispose();
    this.charcoalRenderer = null;
    this.fireTipTracker = null;
    // Clean up LED overlay
    this.ledRenderer?.dispose();
    this.ledRenderer = null;
    this.ledTipTracker = null;
    // Clean up trail overlay
    this.trailOverlay = null;
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

    // Determine what actually needs continuous rendering
    const trailsNeedContinuousRender =
      trailSettings.enabled && trailSettings.mode !== TrailMode.OFF;
    const backgroundTransitioning =
      this.renderer?.isBackgroundTransitioning() ?? false;
    const fireActive =
      params.fireConfig?.enabled === true &&
      (this.fireRenderer?.isInitialized() === true ||
       this.charcoalRenderer?.isInitialized() === true);
    const ledActive =
      params.ledConfig?.enabled === true &&
      this.ledRenderer?.isInitialized() === true;

    // Active work: playing, effects running, background animating, or explicit render request
    const hasActiveWork =
      this.needsRender ||
      isPlaying ||
      backgroundTransitioning ||
      fireActive ||
      ledActive;

    // Trails alone (without active work) should not keep the loop alive forever.
    // Allow a grace period for initialization/texture loading, then auto-stop.
    if (hasActiveWork) {
      this.consecutiveIdleFrames = 0;
    } else {
      this.consecutiveIdleFrames++;
    }

    const shouldContinueLoop =
      hasActiveWork ||
      trailsNeedContinuousRender &&
        this.consecutiveIdleFrames < AnimationRenderLoop.IDLE_STOP_THRESHOLD;

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
      // Stop loop — triggerRender() will restart if needed
      this.rafId = null;
      this.consecutiveIdleFrames = 0;
    }
  };

  private render(params: RenderFrameParams, currentTime: number): void {
    if (!this.renderer) return;

    // Measure RAF-to-RAF gap (includes browser layout, GC, other JS, vsync wait)
    const rafGap = this.lastFrameTime > 0 ? currentTime - this.lastFrameTime : 0;
    this.lastFrameTime = currentTime;

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

    if (this.loopStartTime === 0) {
      this.loopStartTime = currentTime;
    }

    // Gather trail points
    const trailPoints = this.gatherTrailPoints(currentStep, trailSettings, params.isSeamlesslyLoopable ?? false);

    // Update loopStartTime when a loop is detected (set inside gatherTrailPoints)
    if (this.loopDetectedThisFrame) {
      this.loopStartTime = currentTime;
    }

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

    // Read prop transforms from Canvas2D renderer for fire coherence
    const renderedTransforms = this.renderer?.getLastPropTransforms?.() ?? undefined;

    // Fire/charcoal overlay: render after Canvas2D so it composites on top.
    // Fire and charcoal are independent renderers that share tip tracking.
    const activeFireRenderer = this.fireRenderer?.isInitialized() ? this.fireRenderer : null;
    const activeCharcoalRenderer = this.charcoalRenderer?.isInitialized() ? this.charcoalRenderer : null;
    const hasActiveOverlay = this.fireTipTracker && (
      (activeFireRenderer && params.fireConfig?.enabled) || activeCharcoalRenderer
    );

    if (hasActiveOverlay) {
      // Reset tip tracker on loop to prevent velocity spike from position teleport.
      // Without this, the position delta (end-of-sequence → start-of-sequence) produces
      // a massive velocity injection that pushes fire off the prop tips.
      if (this.loopDetectedThisFrame) {
        this.fireTipTracker!.reset();
      }

      const tipTrackerConfig: FireTipTrackerConfig = {
        canvasSize: this.canvasSize,
        bluePropDimensions: props.bluePropDimensions,
        redPropDimensions: props.redPropDimensions,
        bluePropType: params.bluePropType,
        redPropType: params.redPropType,
        renderedTransforms,
      };

      const tipResult = this.fireTipTracker!.update(
        props.blueProp,
        props.redProp,
        tipTrackerConfig,
        currentTime
      );

      const fireInput: import("../../domain/types/FireTypes").FireFrameInput = {
        tips: tipResult.tips,
        currentTime,
        canvasWidth: this.canvasSize,
        canvasHeight: this.canvasSize,
        darkMode: params.darkMode ?? false,
        propColors: params.propColors,
        loopDetected: this.loopDetectedThisFrame || tipResult.gapDetected,
        playbackSpeed: params.playbackSpeed,
        sequenceContentHash: params.sequenceContentHash,
        relativeTime: currentTime - this.loopStartTime,
        isSeamlesslyLoopable: params.isSeamlesslyLoopable ?? false,
      };

      if (activeFireRenderer) {
        if (tipResult.gapDetected) {
          activeFireRenderer.clearSimulation();
        }
        activeFireRenderer.renderFire(fireInput, params.fireConfig!);
      } else if (activeCharcoalRenderer) {
        if (tipResult.gapDetected) {
          activeCharcoalRenderer.clearSimulation();
        }
        activeCharcoalRenderer.renderCharcoal(fireInput, params.fireConfig!);
      }
    }

    // LED overlay: render after fire so it composites on top of both Canvas2D and fire
    if (
      this.ledRenderer?.isInitialized() &&
      this.ledTipTracker &&
      params.ledConfig?.enabled
    ) {
      const tipTrackerConfig: LedTipTrackerConfig = {
        canvasSize: this.canvasSize,
        bluePropDimensions: props.bluePropDimensions,
        redPropDimensions: props.redPropDimensions,
        bluePropType: params.bluePropType,
        redPropType: params.redPropType,
      };

      const tips = this.ledTipTracker.update(
        props.blueProp,
        props.redProp,
        tipTrackerConfig,
        currentTime,
        params.ledConfig
      );

      this.ledRenderer.renderLeds(
        {
          tips,
          currentTime,
          canvasWidth: this.canvasSize,
          canvasHeight: this.canvasSize,
        },
        params.ledConfig
      );
    }

    // End frame budget measurement (updates rolling averages, may trigger tier change)
    const renderTime = performance.now() - frameStart;

    if (this.frameBudgetMonitor) {
      this.frameBudgetMonitor.endFrame(frameStart);

      // Propagate quality tier changes to fire renderer
      const hints = this.frameBudgetMonitor.getQualityHints();
      if (hints && hints.tier !== this.previousQualityTier) {
        this.previousQualityTier = hints.tier;
        if (this.fireRenderer?.isInitialized()) {
          // Map quality tier → fire simulation quality level
          const fireQuality = hints.tier === QualityTier.HIGH ? 3
            : hints.tier === QualityTier.MEDIUM ? 2
            : 1;
          this.fireRenderer.setQuality(fireQuality);
        }
      }
    }

    // Frame drop diagnostics: log when frames exceed budget
    // Rate-limited to prevent feedback loops with console recording extensions (rrweb, Sentry, etc.)
    // Skip during warm-up (first N frames have high RAF gaps from browser initialization)
    this.framesRenderedSinceStart++;
    const isWarmingUp = this.framesRenderedSinceStart <= AnimationRenderLoop.WARMUP_FRAMES;
    const isFirstFrameAfterRestart = rafGap > 1000;
    const logEnabled = this.frameDropLoggingEnabled ||
      (typeof window !== "undefined" && (window as any).__TKA_FRAME_DROP_LOG === true);
    if (
      logEnabled &&
      !isWarmingUp &&
      !isFirstFrameAfterRestart &&
      params.isPlaying &&
      (renderTime > AnimationRenderLoop.FRAME_DROP_THRESHOLD_MS ||
       rafGap > 100) // RAF gap > 100ms means browser missed 5+ vsyncs (genuine stall)
    ) {
      const now = performance.now();
      if (now - this.lastFrameDropLogTime > AnimationRenderLoop.FRAME_DROP_LOG_COOLDOWN_MS) {
        this.lastFrameDropLogTime = now;
        const fireState = this.fireRenderer?.isInitialized()
          ? (params.fireConfig?.enabled ? "active" : "idle")
          : "off";
        const trailCount = params.trailSettings.enabled
          ? this.reusableBlueTrailPoints.length + this.reusableRedTrailPoints.length
          : 0;
        console.warn(
          `[FrameDrop] render=${renderTime.toFixed(1)}ms rafGap=${rafGap.toFixed(1)}ms ` +
          `step=${params.currentStep.toFixed(2)} fire=${fireState} ` +
          `trails=${trailCount} tier=${this.previousQualityTier ?? "?"} ` +
          `loop=${this.loopDetectedThisFrame ? "YES" : "no"}`
        );
      }
    }
  }

  private gatherTrailPoints(
    currentStep: number,
    trailSettings: TrailSettings,
    isSeamlesslyLoopable: boolean
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
    this.loopDetectedThisFrame = false;
    if (this.previousStep - currentStep > LOOP_DETECTION_THRESHOLD) {
      this.loopDetectedThisFrame = true;
      this.hasLoopedAtLeastOnce = true;
      // For non-seamless loops, record where the loop occurred to clamp trail start.
      // For seamless loops, don't clamp — trails wrap around the boundary.
      if (!isSeamlesslyLoopable) {
        this.loopOccurredAtStep = currentStep;
      } else {
        // Clear any stale clamp from a previous non-seamless session
        this.loopOccurredAtStep = null;
      }
    }
    this.previousStep = currentStep;

    // Use cache for perfect gap-free trails (if available and valid)
    const usingCache = this.pathCache && this.pathCache.isValid() && currentStep !== null;

    if (usingCache && this.pathCache) {
      const scaleFactor = this.canvasSize / 950;
      const cacheInfo = this.pathCache.getCacheInfo();

      if (cacheInfo && cacheInfo.totalSteps > 0) {
        const stepDurationMs = cacheInfo.totalDurationMs / cacheInfo.totalSteps;

        // Calculate how many steps the trail should span
        const fadeSteps = trailSettings.mode === TrailMode.FADE && trailSettings.fadeDurationMs > 0
          ? trailSettings.fadeDurationMs / stepDurationMs
          : currentStep; // Non-fade: show entire trail from step 0

        const desiredStart = currentStep - fadeSteps;

        // Determine if trail wraps around the loop boundary.
        // Only wrap if a loop has actually occurred — on initial play there's
        // no previous loop to read trail data from.
        const needsWrapAround = isSeamlesslyLoopable && desiredStart < 0 && this.hasLoopedAtLeastOnce;

        if (needsWrapAround) {
          // SEAMLESS LOOP WRAP-AROUND:
          // Trail window spans the loop boundary, so read from two ranges:
          //   1. Tail of previous loop: [totalSteps + desiredStart, totalSteps]
          //   2. Head of current loop:  [0, currentStep]
          // We read the tail up to totalSteps (not totalSteps + 1) because
          // position at totalSteps equals position at 0 for seamless loops.
          // Using totalSteps + 1 would extend the tail 1 beat past the boundary,
          // causing a spatial fold-back (trail doubles back) and a visible jump
          // in the trail's oldest visible position.
          const cacheEndStep = cacheInfo.totalSteps;
          const wrapStartStep = Math.max(0, cacheEndStep + desiredStart);

          // Blue prop: tail segment (both ends) then head segment (both ends)
          let blueCount = this.pathCache.fillTrailPoints(
            0, 0, wrapStartStep, cacheEndStep, scaleFactor,
            this.reusableBlueTrailPoints, 0
          );
          blueCount += this.pathCache.fillTrailPoints(
            0, 1, wrapStartStep, cacheEndStep, scaleFactor,
            this.reusableBlueTrailPoints, blueCount
          );
          blueCount += this.pathCache.fillTrailPoints(
            0, 0, 0, currentStep, scaleFactor,
            this.reusableBlueTrailPoints, blueCount
          );
          blueCount += this.pathCache.fillTrailPoints(
            0, 1, 0, currentStep, scaleFactor,
            this.reusableBlueTrailPoints, blueCount
          );
          this.reusableBlueTrailPoints.length = blueCount;

          // Red prop: tail segment (both ends) then head segment (both ends)
          let redCount = this.pathCache.fillTrailPoints(
            1, 0, wrapStartStep, cacheEndStep, scaleFactor,
            this.reusableRedTrailPoints, 0
          );
          redCount += this.pathCache.fillTrailPoints(
            1, 1, wrapStartStep, cacheEndStep, scaleFactor,
            this.reusableRedTrailPoints, redCount
          );
          redCount += this.pathCache.fillTrailPoints(
            1, 0, 0, currentStep, scaleFactor,
            this.reusableRedTrailPoints, redCount
          );
          redCount += this.pathCache.fillTrailPoints(
            1, 1, 0, currentStep, scaleFactor,
            this.reusableRedTrailPoints, redCount
          );
          this.reusableRedTrailPoints.length = redCount;
        } else {
          // NORMAL PATH (non-seamless, or seamless but trail doesn't cross boundary yet)
          let startStep = Math.max(0, desiredStart);

          // For non-seamless loops, clamp at loop point to prevent stale trail artifacts
          if (this.loopOccurredAtStep !== null) {
            startStep = Math.max(startStep, this.loopOccurredAtStep);
          }

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
        }
      }
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
