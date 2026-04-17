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
import type { IZapOverlayRenderer } from "../contracts/IZapOverlayRenderer";
import type { ISparklesOverlayRenderer } from "../contracts/ISparklesOverlayRenderer";
import type { ZapTipInput } from "$lib/shared/effects/renderers/Zap2DRenderer";
import type { SparklesTipInput } from "$lib/shared/effects/renderers/Sparkles2DRenderer";
import type {
  IAnimationRenderLoop,
  RenderLoopConfig,
  RenderFrameParams,
} from "../contracts/IAnimationRenderLoop";
import { QualityTier } from "../../domain/types/QualityTypes";
import { effectErrorSignal } from "../../state/effect-error-signal.svelte";
import { resolveEffect } from "../../domain/types/TipEffectTypes";
import type { TipEffectMap } from "../../domain/types/TipEffectTypes";

// ============================================================================
// Longtask observer singleton — one PerformanceObserver shared across every
// AnimationRenderLoop instance. Without this, each loop attaches its own
// observer and every main-thread stall produces N duplicate log lines where
// N is the number of live AnimatorCanvas instances on the page.
// ============================================================================
type LongTaskListener = (durationMs: number) => void;
const longTaskListeners = new Set<LongTaskListener>();
let longTaskObserverInstalled = false;
let lastBigLongTaskLogTime = 0;

function installLongTaskObserver(): void {
  if (longTaskObserverInstalled) return;
  if (typeof PerformanceObserver === "undefined") return;
  if (!PerformanceObserver.supportedEntryTypes?.includes("longtask")) return;
  try {
    const observer = new PerformanceObserver((list) => {
      const now = performance.now();
      const warnEnabled =
        typeof window !== "undefined" &&
        (window as { __TKA_FPS_LOG?: boolean }).__TKA_FPS_LOG === true;
      for (const entry of list.getEntries()) {
        for (const listener of longTaskListeners) listener(entry.duration);
        // Warn once per 2s for individually-huge stalls when the FPS diagnostic
        // is enabled. Otherwise the listener just accumulates duration for the
        // FPS summary window (which itself is gated).
        if (warnEnabled && entry.duration > 150 && now - lastBigLongTaskLogTime > 2000) {
          lastBigLongTaskLogTime = now;
          console.warn(`[LongTask] ${entry.duration.toFixed(0)}ms main-thread block`);
        }
      }
    });
    observer.observe({ entryTypes: ["longtask"] });
    longTaskObserverInstalled = true;
  } catch {
    // Observer setup failed — silently degrade (FPS summary still works).
  }
}

function subscribeToLongTasks(listener: LongTaskListener): () => void {
  installLongTaskObserver();
  longTaskListeners.add(listener);
  return () => longTaskListeners.delete(listener);
}

function hasTrailTips(map: TipEffectMap | undefined): boolean {
  if (!map) return false;
  return Object.values(map).some(a => a.effect === "trails");
}

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
  private zapRenderer: IZapOverlayRenderer | null = null;
  private sparklesRenderer: ISparklesOverlayRenderer | null = null;
  private onEffectError: ((effectName: string, error: Error) => void) | null = null;
  private canvasSize: number = 950;
  private lastTrailFrameTime: number = 0;
  private lastSparklesFrameTime: number = 0;
  private rafId: number | null = null;
  private needsRender: boolean = false;
  private getFrameParamsCallback: (() => RenderFrameParams) | null = null;
  private isDisposed: boolean = false; // Prevent RAF from continuing after disposal

  // Effect error tracking: auto-recover on first failure, escalate on repeated failures
  private consecutiveFireErrors: number = 0;
  private consecutiveLedErrors: number = 0;
  private consecutiveZapErrors: number = 0;
  private consecutiveSparklesErrors: number = 0;
  private fireDisabledByError: boolean = false;
  private ledDisabledByError: boolean = false;
  private zapDisabledByError: boolean = false;
  private sparklesDisabledByError: boolean = false;
  private static readonly EFFECT_ERROR_THRESHOLD = 3;

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

  // Track 2D overlay suppression state to clear canvases on transition
  private wasSuppressed: boolean = false;

  // Frame drop diagnostics — logs slow frames to console for debugging.
  // Disabled by default. Enable via browser console: window.__TKA_FRAME_DROP_LOG = true
  private frameDropLoggingEnabled = false;
  private static readonly FRAME_DROP_THRESHOLD_MS = 20; // ~50fps — anything below 60fps
  private lastFrameTime = 0; // Track RAF-to-RAF gap (true frame duration including browser overhead)
  private lastFrameDropLogTime = 0; // Rate-limit logs to avoid feedback loop with console recording extensions
  private static readonly FRAME_DROP_LOG_COOLDOWN_MS = 2000; // Max 1 log per 2 seconds
  private framesRenderedSinceStart = 0; // Warm-up grace period — skip frame drop logging for first N frames
  private static readonly WARMUP_FRAMES = 10; // First 10 frames always have high RAF gaps

  // Rolling FPS summary — logs once per second while playing so you can see
  // average FPS + min/max frame time + frame count without spamming per-frame.
  // Enabled by default; gate with window.__TKA_FPS_LOG = false to silence.
  private fpsWindowStart = 0;          // performance.now() at window open
  private fpsWindowFrames = 0;         // frames rendered in current window
  private fpsWindowMinFrameMs = Infinity;
  private fpsWindowMaxFrameMs = 0;
  private fpsWindowMaxRenderMs = 0;    // slowest render() call this window
  private fpsWindowRenderMsSum = 0;    // sum of render() times this window
  private fpsWindowDrops = 0;          // frames this window that breached budget
  private fpsWindowLongTaskMs = 0;     // total longtask ms attributed to window (read from module singleton)
  private longTaskSubscriberDispose: (() => void) | null = null;

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
    this.zapRenderer = config.zapRenderer ?? null;
    this.sparklesRenderer = config.sparklesRenderer ?? null;
    this.onEffectError = config.onEffectError ?? null;

    // Subscribe to the module-singleton longtask observer so the FPS summary
    // can attribute main-thread stalls to the window in which they occurred.
    // One observer serves all AnimationRenderLoop instances — without the
    // singleton, N loops produced N duplicate log lines per longtask.
    if (!this.longTaskSubscriberDispose) {
      this.longTaskSubscriberDispose = subscribeToLongTasks((durationMs) => {
        this.fpsWindowLongTaskMs += durationMs;
      });
    }
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
    if (config.zapRenderer !== undefined)
      this.zapRenderer = config.zapRenderer ?? null;
    if (config.sparklesRenderer !== undefined)
      this.sparklesRenderer = config.sparklesRenderer ?? null;
    if (config.onEffectError !== undefined)
      this.onEffectError = config.onEffectError ?? null;
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
    // Reset effect error tracking so effects can retry on next start
    this.consecutiveFireErrors = 0;
    this.consecutiveLedErrors = 0;
    this.consecutiveZapErrors = 0;
    this.fireDisabledByError = false;
    this.ledDisabledByError = false;
    this.zapDisabledByError = false;
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

  /** Snapshot of render loop state for diagnostic reports. */
  getDiagnostics(): Record<string, unknown> {
    return {
      isRunning: this.rafId !== null,
      isDisposed: this.isDisposed,
      previousStep: this.previousStep,
      loopDetectedThisFrame: this.loopDetectedThisFrame,
      hasLoopedAtLeastOnce: this.hasLoopedAtLeastOnce,
      loopStartTime: this.loopStartTime,
      qualityTier: this.previousQualityTier,
      consecutiveFireErrors: this.consecutiveFireErrors,
      consecutiveLedErrors: this.consecutiveLedErrors,
      fireDisabledByError: this.fireDisabledByError,
      ledDisabledByError: this.ledDisabledByError,
      consecutiveIdleFrames: this.consecutiveIdleFrames,
      framesRenderedSinceStart: this.framesRenderedSinceStart,
      canvasSize: this.canvasSize,
      fireRendererInitialized: this.fireRenderer?.isInitialized() ?? false,
      charcoalRendererInitialized: this.charcoalRenderer?.isInitialized() ?? false,
      ledRendererInitialized: this.ledRenderer?.isInitialized() ?? false,
      hasTrailOverlay: !!this.trailOverlay,
      fireTipDiagnostics: (this.fireTipTracker as any)?.getDiagnostics?.() ?? null,
      fireRendererDiagnostics: (this.fireRenderer as any)?.getDiagnostics?.() ?? null,
    };
  }

  dispose(): void {
    // Mark as disposed FIRST to stop any pending RAF callbacks
    this.isDisposed = true;
    this.stop();
    this.longTaskSubscriberDispose?.();
    this.longTaskSubscriberDispose = null;
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
    // Clean up zap overlay
    this.zapRenderer?.dispose();
    this.zapRenderer = null;
    this.sparklesRenderer?.dispose();
    this.sparklesRenderer = null;
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
    const trailsActive = hasTrailTips(params.tipEffectMap);
    if (
      trailsActive &&
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
      hasTrailTips(params.tipEffectMap) && trailSettings.mode !== TrailMode.OFF;
    const backgroundTransitioning =
      this.renderer?.isBackgroundTransitioning() ?? false;
    // Fire or charcoal overlay is active. fireConfig is passed only when either
    // effect is active (see AnimationEngine.getFrameParams), so presence is the gate.
    const fireActive =
      params.fireConfig != null &&
      this.fireRenderer?.isInitialized() === true;
    const charcoalActive =
      this.charcoalRenderer?.isInitialized() === true &&
      params.fireConfig != null;
    const ledActive =
      params.ledConfig?.enabled === true &&
      this.ledRenderer?.isInitialized() === true;
    const zapActive =
      params.zapConfig != null &&
      this.zapRenderer?.isInitialized() === true;
    const sparklesActive =
      params.sparklesConfig != null &&
      this.sparklesRenderer?.isInitialized() === true;

    // Active work: playing, effects running, background animating, or explicit render request
    const hasActiveWork =
      this.needsRender ||
      isPlaying ||
      backgroundTransitioning ||
      fireActive ||
      charcoalActive ||
      ledActive ||
      zapActive;

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

    // Gather trail points. When the trail overlay is active (chaining mode),
    // disable seamless loop wrap-around — the overlay accumulates pixels
    // across sequences, so wrap-around would draw the loop-back path on
    // top of the next sequence's trail.
    const effectiveLoopable = this.trailOverlay
      ? false
      : (params.isSeamlesslyLoopable ?? false);
    const trailPoints = this.gatherTrailPoints(currentStep, trailSettings, effectiveLoopable);

    // Update loopStartTime when a loop is detected (set inside gatherTrailPoints)
    if (this.loopDetectedThisFrame) {
      this.loopStartTime = currentTime;
    }

    // Apply visibility settings
    const effectiveGridVisible = gridVisible && visibility.gridVisible;
    const effectivePropsVisible = visibility.propsVisible;
    const effectiveTrailsVisible = hasTrailTips(params.tipEffectMap);

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

    // When entering 3D suppression mode, clear all overlay canvases so stale
    // frames don't bleed through. The 3D layer sits on top via z-index, but
    // WebGL overlay canvases can show through if not cleared.
    if (params.suppress2DOverlays && !this.wasSuppressed) {
      this.wasSuppressed = true;
      // Clear all overlay canvases so stale frames don't show through the 3D layer
      const overlayCanvases = [
        this.fireRenderer?.isInitialized() ? this.fireRenderer.getCanvas() : null,
        this.charcoalRenderer?.isInitialized() ? this.charcoalRenderer.getCanvas() : null,
        this.ledRenderer?.isInitialized() ? this.ledRenderer.getCanvas() : null,
      ];
      for (const canvas of overlayCanvases) {
        if (!canvas) continue;
        const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
        if (gl) {
          gl.clear(gl.COLOR_BUFFER_BIT);
        }
      }
      // Clear trail overlay (Canvas2D)
      if (this.trailOverlay) {
        const trailCanvas = (this.trailOverlay as any).canvas as HTMLCanvasElement | undefined;
        if (trailCanvas) {
          const ctx = trailCanvas.getContext("2d");
          if (ctx) ctx.clearRect(0, 0, trailCanvas.width, trailCanvas.height);
        }
      }
      // Clear zap overlay (Canvas2D)
      if (this.zapRenderer?.isInitialized()) {
        this.zapRenderer.clear();
      }
      // Clear sparkles overlay (Canvas2D)
      if (this.sparklesRenderer?.isInitialized()) {
        this.sparklesRenderer.clear();
      }
    } else if (!params.suppress2DOverlays && this.wasSuppressed) {
      this.wasSuppressed = false;
    }

    // Route trail rendering through the overlay canvas
    if (this.trailOverlay && effectiveTrailsVisible && !params.suppress2DOverlays) {
      const now = performance.now();
      const dt = this.lastTrailFrameTime > 0
        ? (now - this.lastTrailFrameTime) / 1000
        : 1 / 60;
      this.lastTrailFrameTime = now;

      this.trailOverlay.renderFrame({
        blueTrailPoints: effectiveBlueMotionVisible ? trailPoints.blue : [],
        redTrailPoints: effectiveRedMotionVisible ? trailPoints.red : [],
        trailSettings,
        deltaTime: dt,
        canvasSize: this.canvasSize,
        hasBlue: !!params.props.blueProp && effectiveBlueMotionVisible,
        hasRed: !!params.props.redProp && effectiveRedMotionVisible,
        additionalLayers: additionalLayerRenderData.length > 0 ? additionalLayerRenderData : undefined,
        blueProp: params.props.blueProp,
        redProp: params.props.redProp,
        bluePropType: params.bluePropType,
        redPropType: params.redPropType,
      });
    }

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
      skipTrailRendering: !!this.trailOverlay,
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

    // Fire/charcoal/zap overlays: render after Canvas2D so they composite on top.
    // Fire, charcoal, and zap all consume FireTipTracker output (zap reads the
    // same {x,y} positions but ignores velocity). The tracker is updated at most
    // once per frame and the result is shared across the three branches below.
    const activeFireRenderer = this.fireRenderer?.isInitialized() ? this.fireRenderer : null;
    const activeCharcoalRenderer = this.charcoalRenderer?.isInitialized() ? this.charcoalRenderer : null;
    const activeZapRenderer = this.zapRenderer?.isInitialized() ? this.zapRenderer : null;
    const hasFireOrCharcoalOverlay = this.fireTipTracker && (
      (activeFireRenderer && params.fireConfig != null) || activeCharcoalRenderer
    );
    const hasZapOverlay = this.fireTipTracker && activeZapRenderer && params.zapConfig != null;
    const hasSparklesOverlayForTipUpdate =
      this.fireTipTracker
      && this.sparklesRenderer?.isInitialized()
      && params.sparklesConfig != null;
    const hasAnyTipOverlay = hasFireOrCharcoalOverlay || hasZapOverlay || hasSparklesOverlayForTipUpdate;

    let sharedTipResult: import("../contracts/IFireTipTracker").FireTipUpdateResult | null = null;
    if (hasAnyTipOverlay && !params.suppress2DOverlays) {
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

      sharedTipResult = this.fireTipTracker!.update(
        props.blueProp,
        props.redProp,
        tipTrackerConfig,
        currentTime
      );
    }

    if (hasFireOrCharcoalOverlay && !this.fireDisabledByError && !params.suppress2DOverlays && sharedTipResult) {
      try {
        const tipResult = sharedTipResult;

        // Filter tips by resolved effect so each renderer only gets its assigned tips.
        // tipEffectMap is always the authority. No legacy fallback.
        const allTips = tipResult.tips;
        const tipMap = params.tipEffectMap ?? {};

        const fireTips = allTips.filter(t => resolveEffect(t.propIndex, t.tipIndex, tipMap, {}) === 'fire');
        const charcoalTips = allTips.filter(t => resolveEffect(t.propIndex, t.tipIndex, tipMap, {}) === 'charcoal');

        const fireInput: import("../../domain/types/FireTypes").FireFrameInput = {
          tips: allTips,
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

        // Fire and charcoal can now run simultaneously on different tips
        if (activeFireRenderer && fireTips.length > 0) {
          if (tipResult.gapDetected) {
            activeFireRenderer.clearSimulation();
          }
          activeFireRenderer.renderFire({ ...fireInput, tips: fireTips }, params.fireConfig!);
        }
        if (activeCharcoalRenderer && charcoalTips.length > 0) {
          if (tipResult.gapDetected) {
            activeCharcoalRenderer.clearSimulation();
          }
          activeCharcoalRenderer.renderCharcoal({ ...fireInput, tips: charcoalTips }, params.fireConfig!);
        }

        // Successful frame resets the error counter
        this.consecutiveFireErrors = 0;
      } catch (error) {
        this.consecutiveFireErrors++;

        // First few failures: reset state and try again next frame
        this.fireTipTracker?.reset();
        activeFireRenderer?.clearSimulation();
        activeCharcoalRenderer?.clearSimulation();

        if (this.consecutiveFireErrors >= AnimationRenderLoop.EFFECT_ERROR_THRESHOLD) {
          // Repeated failures: disable fire and notify user
          this.fireDisabledByError = true;
          const err = error instanceof Error ? error : new Error(String(error));
          console.error("[AnimationRenderLoop] Fire effect disabled after repeated failures:", err);
          if (this.onEffectError) {
            this.onEffectError("fire", err);
          } else {
            effectErrorSignal.trigger("fire", err);
          }
        } else {
          console.warn(
            `[AnimationRenderLoop] Fire render error (attempt ${this.consecutiveFireErrors}/${AnimationRenderLoop.EFFECT_ERROR_THRESHOLD}), resetting:`,
            error
          );
        }
      }
    }

    // Zap (lightning) overlay: draws procedural arcs between blue/red prop tips.
    // Reads the same shared tip positions as fire/charcoal but ignores velocity.
    // Composites on top of fire (z-index 2) so arcs read cleanly over flame glow.
    if (hasZapOverlay && !this.zapDisabledByError && !params.suppress2DOverlays && sharedTipResult) {
      try {
        const tipMap = params.tipEffectMap ?? {};
        const zapInput: ZapTipInput = {
          bluePosA: null,
          bluePosB: null,
          redPosA: null,
          redPosB: null,
        };
        // Pull the (up to 2) tips per prop assigned to "zap" out of the shared
        // tracker result. Indexing maps {propIndex 0 = blue, 1 = red} and
        // {tipIndex 0 = A, 1 = B}, matching the 3D zap shader's convention.
        for (const t of sharedTipResult.tips) {
          if (resolveEffect(t.propIndex, t.tipIndex, tipMap, {}) !== "zap") continue;
          const pos = { x: t.x, y: t.y };
          if (t.propIndex === 0) {
            if (t.tipIndex === 0) zapInput.bluePosA = pos;
            else if (t.tipIndex === 1) zapInput.bluePosB = pos;
          } else if (t.propIndex === 1) {
            if (t.tipIndex === 0) zapInput.redPosA = pos;
            else if (t.tipIndex === 1) zapInput.redPosB = pos;
          }
        }

        activeZapRenderer!.renderFrame(params.zapConfig!, zapInput);
        this.consecutiveZapErrors = 0;
      } catch (error) {
        this.consecutiveZapErrors++;
        activeZapRenderer?.clear();

        if (this.consecutiveZapErrors >= AnimationRenderLoop.EFFECT_ERROR_THRESHOLD) {
          this.zapDisabledByError = true;
          const err = error instanceof Error ? error : new Error(String(error));
          console.error("[AnimationRenderLoop] Zap effect disabled after repeated failures:", err);
          if (this.onEffectError) {
            this.onEffectError("zap", err);
          } else {
            effectErrorSignal.trigger("zap", err);
          }
        } else {
          console.warn(
            `[AnimationRenderLoop] Zap render error (attempt ${this.consecutiveZapErrors}/${AnimationRenderLoop.EFFECT_ERROR_THRESHOLD}), resetting:`,
            error
          );
        }
      }
    } else if (activeZapRenderer && !hasZapOverlay) {
      // Zap renderer exists but no zap config / not active this frame — clear
      // any leftover arcs so they don't sit stale on screen.
      activeZapRenderer.clear();
    }

    // Sparkles overlay: particle sparkles around prop tips. Reads the same
    // shared tip positions as fire/charcoal/zap.
    const activeSparklesRenderer = this.sparklesRenderer?.isInitialized()
      ? this.sparklesRenderer
      : null;
    const hasSparklesOverlay =
      this.fireTipTracker && activeSparklesRenderer && params.sparklesConfig != null;

    if (
      hasSparklesOverlay &&
      !this.sparklesDisabledByError &&
      !params.suppress2DOverlays &&
      sharedTipResult
    ) {
      try {
        const tipMap = params.tipEffectMap ?? {};
        const sparklesInput: SparklesTipInput = {
          bluePosA: null,
          bluePosB: null,
          redPosA: null,
          redPosB: null,
        };
        for (const t of sharedTipResult.tips) {
          if (resolveEffect(t.propIndex, t.tipIndex, tipMap, {}) !== "sparkles") continue;
          const pos = { x: t.x, y: t.y };
          if (t.propIndex === 0) {
            if (t.tipIndex === 0) sparklesInput.bluePosA = pos;
            else if (t.tipIndex === 1) sparklesInput.bluePosB = pos;
          } else if (t.propIndex === 1) {
            if (t.tipIndex === 0) sparklesInput.redPosA = pos;
            else if (t.tipIndex === 1) sparklesInput.redPosB = pos;
          }
        }
        // Use a sparkles-specific frame timestamp so dt is correct even when
        // trails are disabled. Clamp to avoid catastrophic dt on first frame
        // or after a long pause.
        const rawDt = this.lastSparklesFrameTime > 0
          ? (currentTime - this.lastSparklesFrameTime) / 1000
          : 1 / 60;
        const dt = Math.min(0.1, rawDt);
        this.lastSparklesFrameTime = currentTime;
        activeSparklesRenderer!.renderFrame(params.sparklesConfig!, sparklesInput, dt);
        this.consecutiveSparklesErrors = 0;
      } catch (error) {
        this.consecutiveSparklesErrors++;
        activeSparklesRenderer?.clear();
        if (this.consecutiveSparklesErrors >= AnimationRenderLoop.EFFECT_ERROR_THRESHOLD) {
          this.sparklesDisabledByError = true;
          const err = error instanceof Error ? error : new Error(String(error));
          console.error("[AnimationRenderLoop] Sparkles effect disabled after repeated failures:", err);
          if (this.onEffectError) {
            this.onEffectError("sparkles", err);
          } else {
            effectErrorSignal.trigger("sparkles", err);
          }
        } else {
          console.warn(
            `[AnimationRenderLoop] Sparkles render error (attempt ${this.consecutiveSparklesErrors}/${AnimationRenderLoop.EFFECT_ERROR_THRESHOLD}), resetting:`,
            error
          );
        }
      }
    } else if (activeSparklesRenderer && !hasSparklesOverlay) {
      activeSparklesRenderer.clear();
    }

    // LED overlay: render after fire so it composites on top of both Canvas2D and fire
    if (
      this.ledRenderer?.isInitialized() &&
      this.ledTipTracker &&
      params.ledConfig?.enabled &&
      !this.ledDisabledByError &&
      !params.suppress2DOverlays
    ) {
      try {
        const tipTrackerConfig: LedTipTrackerConfig = {
          canvasSize: this.canvasSize,
          bluePropDimensions: props.bluePropDimensions,
          redPropDimensions: props.redPropDimensions,
          bluePropType: params.bluePropType,
          redPropType: params.redPropType,
        };

        const allLedTips = this.ledTipTracker.update(
          props.blueProp,
          props.redProp,
          tipTrackerConfig,
          currentTime,
          params.ledConfig
        );

        // Filter LED tips by resolved effect assignment
        const ledTipMap = params.tipEffectMap ?? {};
        const ledTips = allLedTips.filter(t => resolveEffect(t.propIndex, t.tipIndex, ledTipMap, {}) === 'led');

        if (ledTips.length > 0) {
          this.ledRenderer.renderLeds(
            {
              tips: ledTips,
              currentTime,
              canvasWidth: this.canvasSize,
              canvasHeight: this.canvasSize,
            },
            params.ledConfig
          );
        }

        // Successful frame resets the error counter
        this.consecutiveLedErrors = 0;
      } catch (error) {
        this.consecutiveLedErrors++;

        if (this.consecutiveLedErrors >= AnimationRenderLoop.EFFECT_ERROR_THRESHOLD) {
          this.ledDisabledByError = true;
          const err = error instanceof Error ? error : new Error(String(error));
          console.error("[AnimationRenderLoop] LED effect disabled after repeated failures:", err);
          if (this.onEffectError) {
            this.onEffectError("led", err);
          } else {
            effectErrorSignal.trigger("led", err);
          }
        } else {
          console.warn(
            `[AnimationRenderLoop] LED render error (attempt ${this.consecutiveLedErrors}/${AnimationRenderLoop.EFFECT_ERROR_THRESHOLD}), resetting:`,
            error
          );
        }
      }
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
      (typeof window !== "undefined" && (window as { __TKA_FRAME_DROP_LOG?: boolean }).__TKA_FRAME_DROP_LOG === true);
    const droppedThisFrame =
      params.isPlaying &&
      !isWarmingUp &&
      !isFirstFrameAfterRestart &&
      (renderTime > AnimationRenderLoop.FRAME_DROP_THRESHOLD_MS || rafGap > 100);
    if (logEnabled && droppedThisFrame) {
      const now = performance.now();
      if (now - this.lastFrameDropLogTime > AnimationRenderLoop.FRAME_DROP_LOG_COOLDOWN_MS) {
        this.lastFrameDropLogTime = now;
        const fireState = this.fireRenderer?.isInitialized()
          ? (params.fireConfig != null ? "active" : "idle")
          : "off";
        const trailCount = this.reusableBlueTrailPoints.length + this.reusableRedTrailPoints.length;
        console.warn(
          `[FrameDrop] render=${renderTime.toFixed(1)}ms rafGap=${rafGap.toFixed(1)}ms ` +
          `step=${params.currentStep.toFixed(2)} fire=${fireState} ` +
          `trails=${trailCount} tier=${this.previousQualityTier ?? "?"} ` +
          `loop=${this.loopDetectedThisFrame ? "YES" : "no"}`
        );
      }
    }

    // Rolling 1-second FPS summary — complements the per-drop log by telling
    // you the average even when individual drops fall below the 2s cooldown.
    // Opt-in diagnostic: enable with window.__TKA_FPS_LOG = true
    const fpsLogEnabled =
      typeof window !== "undefined" &&
      (window as { __TKA_FPS_LOG?: boolean }).__TKA_FPS_LOG === true;
    if (fpsLogEnabled && params.isPlaying && !isWarmingUp && !isFirstFrameAfterRestart) {
      if (this.fpsWindowStart === 0) {
        this.fpsWindowStart = currentTime;
      }
      this.fpsWindowFrames++;
      this.fpsWindowRenderMsSum += renderTime;
      if (rafGap > 0) {
        if (rafGap < this.fpsWindowMinFrameMs) this.fpsWindowMinFrameMs = rafGap;
        if (rafGap > this.fpsWindowMaxFrameMs) this.fpsWindowMaxFrameMs = rafGap;
      }
      if (renderTime > this.fpsWindowMaxRenderMs) this.fpsWindowMaxRenderMs = renderTime;
      if (droppedThisFrame) this.fpsWindowDrops++;

      const elapsed = currentTime - this.fpsWindowStart;
      if (elapsed >= 1000) {
        const avgFps = (this.fpsWindowFrames / elapsed) * 1000;
        const avgRender = this.fpsWindowRenderMsSum / this.fpsWindowFrames;
        const fireState = this.fireRenderer?.isInitialized()
          ? (params.fireConfig != null ? "active" : "idle")
          : "off";
        const trailsOn = hasTrailTips(params.tipEffectMap);
        const trailCount = this.reusableBlueTrailPoints.length + this.reusableRedTrailPoints.length;
        console.log(
          `[FPS] ${avgFps.toFixed(1)}fps over ${elapsed.toFixed(0)}ms ` +
          `(${this.fpsWindowFrames} frames) | ` +
          `frame: min=${this.fpsWindowMinFrameMs === Infinity ? "-" : this.fpsWindowMinFrameMs.toFixed(1)}ms ` +
          `max=${this.fpsWindowMaxFrameMs.toFixed(1)}ms | ` +
          `render: avg=${avgRender.toFixed(1)}ms max=${this.fpsWindowMaxRenderMs.toFixed(1)}ms | ` +
          `drops=${this.fpsWindowDrops} longtasks=${this.fpsWindowLongTaskMs.toFixed(0)}ms | ` +
          `fire=${fireState} trails=${trailsOn ? trailCount : "off"} tier=${this.previousQualityTier ?? "?"}`
        );
        this.fpsWindowStart = currentTime;
        this.fpsWindowFrames = 0;
        this.fpsWindowMinFrameMs = Infinity;
        this.fpsWindowMaxFrameMs = 0;
        this.fpsWindowMaxRenderMs = 0;
        this.fpsWindowRenderMsSum = 0;
        this.fpsWindowDrops = 0;
        this.fpsWindowLongTaskMs = 0;
      }
    } else if (!params.isPlaying) {
      // Reset window when playback pauses so the next play-session starts clean
      this.fpsWindowStart = 0;
      this.fpsWindowFrames = 0;
      this.fpsWindowMinFrameMs = Infinity;
      this.fpsWindowMaxFrameMs = 0;
      this.fpsWindowMaxRenderMs = 0;
      this.fpsWindowRenderMsSum = 0;
      this.fpsWindowDrops = 0;
      this.fpsWindowLongTaskMs = 0;
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
    } else if (this.TrailCapturer && !this.trailOverlay) {
      // Fallback to real-time capture — only when NOT using the overlay.
      // The overlay accumulates pixels, so during the brief cache-rebuild
      // gap it's better to draw nothing (existing pixels fade naturally)
      // than to draw broken real-time capture points as artifacts.
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
