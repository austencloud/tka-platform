/**
 * @deprecated Superseded by render-graph FrameGraph + RenderBackend.executeFrame().
 * The render-graph dispatches passes via its own RAF loop with z-ordered
 * scheduling. This file remains active until the render-graph is promoted.
 *
 * Animation Render Loop Implementation
 *
 * Manages the requestAnimationFrame render loop for AnimatorCanvas.
 * Handles RAF scheduling, trail point gathering, and scene rendering.
 */

import type { IAnimationRenderer as AnimationRenderer } from "$lib/shared/animation-engine/services/contracts/IAnimationRenderer";
import type { ITrailCapturer as TrailCapturer } from "$lib/shared/animation-engine/services/contracts/ITrailCapturer";
import type { TrailPoint, TrailSettings } from "../../domain/types/TrailTypes";
import { TrailMode } from "../../domain/types/TrailTypes";
import type { AnimationPathCache } from "$lib/shared/animation-engine/services/implementations/AnimationPathCache";
import type { FrameBudgetMonitor } from '$lib/shared/animation-engine/services/implementations/FrameBudgetMonitor'
import type { WebGLFireRenderer } from "./fire/WebGLFireRenderer";
import type { CharcoalSparkRenderer } from "./charcoal/CharcoalSparkRenderer";
import type { RenderedPropTransform, PropTipData } from "../../domain/types/FireTypes";
import type { FireTipTrackerConfig } from "./FireTipTracker";
import type { FireTipTracker } from "./FireTipTracker";
import type { WebGLLedRenderer } from '$lib/shared/animation-engine/services/implementations/led/WebGLLedRenderer'
import type { LedTipTrackerConfig } from "./LedTipTracker";
import type { LedTipTracker } from "./LedTipTracker";
import type { ITrailOverlayCanvas } from "../contracts/ITrailOverlayCanvas";
import type { ZapOverlayRenderer } from '$lib/shared/animation-engine/services/implementations/ZapOverlayRenderer'
import type { SparklesOverlayRenderer } from '$lib/shared/animation-engine/services/implementations/SparklesOverlayRenderer'
import type { EchoOverlayRenderer } from "./EchoOverlayRenderer";
import type { BloomOverlayRenderer } from "./BloomOverlayRenderer";
import type { WaterOverlayRenderer } from '$lib/shared/animation-engine/services/implementations/WaterOverlayRenderer'
import type { BubblesOverlayRenderer } from "./BubblesOverlayRenderer";
import type { PetalsOverlayRenderer } from '$lib/shared/animation-engine/services/implementations/PetalsOverlayRenderer'
import type { SmokeOverlayRenderer } from '$lib/shared/animation-engine/services/implementations/SmokeOverlayRenderer'
import type { InkOverlayRenderer } from '$lib/shared/animation-engine/services/implementations/InkOverlayRenderer'
import type { FrostOverlayRenderer } from '$lib/shared/animation-engine/services/implementations/FrostOverlayRenderer'
import type { SilkOverlayRenderer } from '$lib/shared/animation-engine/services/implementations/SilkOverlayRenderer'
import type { PulseOverlayRenderer } from '$lib/shared/animation-engine/services/implementations/PulseOverlayRenderer'
import type {
  RenderLoopConfig,
  RenderFrameParams,
} from "../contracts/IAnimationRenderLoop";
import { QualityTier } from "../../domain/types/QualityTypes";
import { effectErrorSignal } from "../../state/effect-error-signal.svelte";
import { resolveEffect } from "../../domain/types/TipEffectTypes";
import type { EffectType, TipEffectMap } from "../../domain/types/TipEffectTypes";
import type { FireTipUpdateResult } from './FireTipTracker';
import type { FireFrameInput } from '../../domain/types/FireTypes';

// ============================================================================
// Longtask observer singleton - one PerformanceObserver shared across every
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
    // Observer setup failed - silently degrade (FPS summary still works).
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


/**
 * Context shared across all registry effect dispatches within a single frame.
 */
interface EffectDispatchContext {
  tipMap: TipEffectMap;
  sharedTips: PropTipData[];
  params: RenderFrameParams;
  currentTime: number;
  renderedTransforms: { blue: RenderedPropTransform | null; red: RenderedPropTransform | null } | undefined;
  loopDetectedThisFrame: boolean;
  isSeamlesslyLoopable: boolean;
}

/**
 * Descriptor for a single registry-driven effect.
 * Each entry defines how to get the renderer, build the tip input,
 * and invoke the renderer's renderFrame method.
 */
type EffectRenderer = { isInitialized(): boolean; clear(): void; renderFrame: (...args: unknown[]) => void };

interface EffectDispatchEntry {
  effect: EffectType;
  configKey: keyof RenderFrameParams;
  getRenderer: (loop: AnimationRenderLoop) => EffectRenderer | null;
  needsDt: boolean;
  resetTimeOnInactive: boolean;
  buildInput: (ctx: EffectDispatchContext, dt: number) => unknown;
  render: (renderer: EffectRenderer, config: unknown, input: unknown, dt: number, ctx: EffectDispatchContext) => void;
}

export class AnimationRenderLoop {
  private renderer: AnimationRenderer | null = null;
  private TrailCapturer: TrailCapturer | null = null;
  private pathCache: AnimationPathCache | null = null;
  private frameBudgetMonitor: FrameBudgetMonitor | null = null;
  private fireRenderer: WebGLFireRenderer | null = null;
  private charcoalRenderer: CharcoalSparkRenderer | null = null;
  private fireTipTracker: FireTipTracker | null = null;
  private ledRenderer: WebGLLedRenderer | null = null;
  private ledTipTracker: LedTipTracker | null = null;
  private trailOverlay: ITrailOverlayCanvas | null = null;
  private zapRenderer: ZapOverlayRenderer | null = null;
  private sparklesRenderer: SparklesOverlayRenderer | null = null;
  private echoRenderer: EchoOverlayRenderer | null = null;
  private bloomRenderer: BloomOverlayRenderer | null = null;
  private waterRenderer: WaterOverlayRenderer | null = null;
  private bubblesRenderer: BubblesOverlayRenderer | null = null;
  private petalsRenderer: PetalsOverlayRenderer | null = null;
  private smokeRenderer: SmokeOverlayRenderer | null = null;
  private inkRenderer: InkOverlayRenderer | null = null;
  private frostRenderer: FrostOverlayRenderer | null = null;
  private silkRenderer: SilkOverlayRenderer | null = null;
  private pulseRenderer: PulseOverlayRenderer | null = null;
  private onEffectError: ((effectName: string, error: Error) => void) | null = null;
  private canvasSize: number = 950;
  private lastTrailFrameTime: number = 0;
  // Timestamp of the last frame that actually stamped the trail accumulator.
  // Separate from lastTrailFrameTime (which uses 0 as an uninitialized
  // sentinel) so the export-duplicate guard works correctly even when the
  // virtualTime is exactly 0 (the first export frame: i/fps * 1000 = 0).
  private lastStampedTrailTime: number | null = null;
  private rafId: number | null = null;
  private needsRender: boolean = false;
  private getFrameParamsCallback: (() => RenderFrameParams) | null = null;
  private isDisposed: boolean = false; // Prevent RAF from continuing after disposal

  // Effect error tracking: auto-recover on first failure, escalate on repeated failures
  // Fire and LED keep dedicated fields (special dispatch logic)
  private consecutiveFireErrors: number = 0;
  private consecutiveLedErrors: number = 0;
  private fireDisabledByError: boolean = false;
  private ledDisabledByError: boolean = false;

  // Registry effects: error tracking via Maps keyed by EffectType
  private readonly effectErrors = new Map<EffectType, number>();
  private readonly effectDisabled = new Map<EffectType, boolean>();
  private readonly effectLastFrameTime = new Map<EffectType, number>();
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

  // Frame drop diagnostics - logs slow frames to console for debugging.
  // Disabled by default. Enable via browser console: window.__TKA_FRAME_DROP_LOG = true
  private frameDropLoggingEnabled = false;
  private static readonly FRAME_DROP_THRESHOLD_MS = 20; // ~50fps - anything below 60fps
  private lastFrameTime = 0; // Track RAF-to-RAF gap (true frame duration including browser overhead)
  private lastFrameDropLogTime = 0; // Rate-limit logs to avoid feedback loop with console recording extensions
  private static readonly FRAME_DROP_LOG_COOLDOWN_MS = 2000; // Max 1 log per 2 seconds
  private framesRenderedSinceStart = 0; // Warm-up grace period - skip frame drop logging for first N frames
  private static readonly WARMUP_FRAMES = 10; // First 10 frames always have high RAF gaps

  // Rolling FPS summary - logs once per second while playing so you can see
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
    this.echoRenderer = config.echoRenderer ?? null;
    this.bloomRenderer = config.bloomRenderer ?? null;
    this.waterRenderer = config.waterRenderer ?? null;
    this.bubblesRenderer = config.bubblesRenderer ?? null;
    this.petalsRenderer = config.petalsRenderer ?? null;
    this.smokeRenderer = config.smokeRenderer ?? null;
    this.inkRenderer = config.inkRenderer ?? null;
    this.frostRenderer = config.frostRenderer ?? null;
    this.silkRenderer = config.silkRenderer ?? null;
    this.pulseRenderer = config.pulseRenderer ?? null;
    this.onEffectError = config.onEffectError ?? null;

    // Subscribe to the module-singleton longtask observer so the FPS summary
    // can attribute main-thread stalls to the window in which they occurred.
    // One observer serves all AnimationRenderLoop instances - without the
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
    if (config.echoRenderer !== undefined)
      this.echoRenderer = config.echoRenderer ?? null;
    if (config.bloomRenderer !== undefined)
      this.bloomRenderer = config.bloomRenderer ?? null;
    if (config.waterRenderer !== undefined)
      this.waterRenderer = config.waterRenderer ?? null;
    if (config.bubblesRenderer !== undefined)
      this.bubblesRenderer = config.bubblesRenderer ?? null;
    if (config.petalsRenderer !== undefined)
      this.petalsRenderer = config.petalsRenderer ?? null;
    if (config.smokeRenderer !== undefined)
      this.smokeRenderer = config.smokeRenderer ?? null;
    if (config.inkRenderer !== undefined)
      this.inkRenderer = config.inkRenderer ?? null;
    if (config.frostRenderer !== undefined)
      this.frostRenderer = config.frostRenderer ?? null;
    if (config.silkRenderer !== undefined)
      this.silkRenderer = config.silkRenderer ?? null;
    if (config.pulseRenderer !== undefined)
      this.pulseRenderer = config.pulseRenderer ?? null;
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
    this.fireDisabledByError = false;
    this.ledDisabledByError = false;
    this.effectErrors.clear();
    this.effectDisabled.clear();
    this.effectLastFrameTime.clear();
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
    this.consecutiveIdleFrames = 0; // Reset idle counter - new work incoming
    this.getFrameParamsCallback = getFrameParams;
    if (this.rafId === null && this.renderer) {
      this.framesRenderedSinceStart = 0; // Reset warm-up on loop restart
      this.rafId = requestAnimationFrame(this.renderLoop);
    }
  }

  setTargetFps(_fps: number | null): void {
    // No-op: FPS throttling removed - time-based animation interpolation
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
      fireTipDiagnostics: this.fireTipTracker?.getDiagnostics?.() ?? null,
      fireRendererDiagnostics: this.fireRenderer?.getDiagnostics?.() ?? null,
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
    this.echoRenderer?.dispose();
    this.echoRenderer = null;
    this.bloomRenderer?.dispose();
    this.bloomRenderer = null;
    this.waterRenderer?.dispose();
    this.waterRenderer = null;
    this.bubblesRenderer?.dispose();
    this.bubblesRenderer = null;
    this.petalsRenderer?.dispose();
    this.petalsRenderer = null;
    this.smokeRenderer?.dispose();
    this.smokeRenderer = null;
    this.inkRenderer?.dispose();
    this.inkRenderer = null;
    this.frostRenderer?.dispose();
    this.frostRenderer = null;
    this.silkRenderer?.dispose();
    this.silkRenderer = null;
    this.pulseRenderer?.dispose();
    this.pulseRenderer = null;
    // Clear reusable arrays to free memory
    this.reusableBlueTrailPoints.length = 0;
    this.reusableRedTrailPoints.length = 0;
    this.reusableAdditionalLayerTrails.length = 0;
  }

  // ---------------------------------------------------------------------------
  // Registry-driven effect dispatch infrastructure
  // ---------------------------------------------------------------------------

  /**
   * Build 4-position tip input ({bluePosA, bluePosB, redPosA, redPosB}) from
   * sharedTipResult. Used by zap, sparkles, echo, water, bubbles, petals,
   * smoke, ink, frost, silk.
   */
  private static buildFourPosTips(
    tips: PropTipData[],
    tipMap: TipEffectMap,
    effect: EffectType
  ): { bluePosA: { x: number; y: number } | null; bluePosB: { x: number; y: number } | null; redPosA: { x: number; y: number } | null; redPosB: { x: number; y: number } | null } {
    const result: { bluePosA: { x: number; y: number } | null; bluePosB: { x: number; y: number } | null; redPosA: { x: number; y: number } | null; redPosB: { x: number; y: number } | null } = {
      bluePosA: null,
      bluePosB: null,
      redPosA: null,
      redPosB: null,
    };
    for (const t of tips) {
      if (resolveEffect(t.propIndex, t.tipIndex, tipMap, {}) !== effect) continue;
      const pos = { x: t.x, y: t.y };
      if (t.propIndex === 0) {
        if (t.tipIndex === 0) result.bluePosA = pos;
        else if (t.tipIndex === 1) result.bluePosB = pos;
      } else if (t.propIndex === 1) {
        if (t.tipIndex === 0) result.redPosA = pos;
        else if (t.tipIndex === 1) result.redPosB = pos;
      }
    }
    return result;
  }

  /**
   * Build array-of-tips input for bloom and pulse (effects that need
   * {x, y, propIndex, tipIndex, blueColor, redColor}[] with center fallback).
   */
  private static buildArrayTips(
    tips: PropTipData[],
    tipMap: TipEffectMap,
    effect: EffectType,
    params: RenderFrameParams,
    renderedTransforms: { blue: RenderedPropTransform | null; red: RenderedPropTransform | null } | undefined
  ): { x: number; y: number; propIndex: 0 | 1; tipIndex: number; blueColor: string; redColor: string }[] {
    const blueColor = params.trailSettings.blueColor;
    const redColor = params.trailSettings.redColor;
    const result: { x: number; y: number; propIndex: 0 | 1; tipIndex: number; blueColor: string; redColor: string }[] = [];
    let globalTipIndex = 0;
    for (const t of tips) {
      if (resolveEffect(t.propIndex, t.tipIndex, tipMap, {}) !== effect) continue;
      result.push({
        x: t.x,
        y: t.y,
        propIndex: t.propIndex as 0 | 1,
        tipIndex: globalTipIndex++,
        blueColor,
        redColor,
      });
    }
    // Center fallback for props with no tip-tracker output
    const blueTransform = renderedTransforms?.blue;
    if (
      params.props.blueProp &&
      blueTransform &&
      resolveEffect(0, 0, tipMap, {}) === effect &&
      !result.some((t) => t.propIndex === 0)
    ) {
      result.push({
        x: blueTransform.centerX,
        y: blueTransform.centerY,
        propIndex: 0,
        tipIndex: globalTipIndex++,
        blueColor,
        redColor,
      });
    }
    const redTransform = renderedTransforms?.red;
    if (
      params.props.redProp &&
      redTransform &&
      resolveEffect(1, 0, tipMap, {}) === effect &&
      !result.some((t) => t.propIndex === 1)
    ) {
      result.push({
        x: redTransform.centerX,
        y: redTransform.centerY,
        propIndex: 1,
        tipIndex: globalTipIndex++,
        blueColor,
        redColor,
      });
    }
    return result;
  }

  /** Dispatch registry — one entry per simple overlay effect. */
  private readonly effectDispatchRegistry: readonly EffectDispatchEntry[] = [
    // --- Zap: 4-pos, no dt ---
    {
      effect: "zap",
      configKey: "zapConfig",
      getRenderer: (l) => l.zapRenderer as EffectRenderer | null,
      needsDt: false,
      resetTimeOnInactive: false,
      buildInput: (ctx) => AnimationRenderLoop.buildFourPosTips(ctx.sharedTips, ctx.tipMap, "zap"),
      render: (r, cfg, inp) => r.renderFrame(cfg, inp),
    },
    // --- Sparkles: 4-pos, dt ---
    {
      effect: "sparkles",
      configKey: "sparklesConfig",
      getRenderer: (l) => l.sparklesRenderer as EffectRenderer | null,
      needsDt: true,
      resetTimeOnInactive: false,
      buildInput: (ctx) => AnimationRenderLoop.buildFourPosTips(ctx.sharedTips, ctx.tipMap, "sparkles"),
      render: (r, cfg, inp, dt) => r.renderFrame(cfg, inp, dt),
    },
    // --- Echo: 4-pos + currentStep + colors, no dt ---
    {
      effect: "echo",
      configKey: "echoConfig",
      getRenderer: (l) => l.echoRenderer as EffectRenderer | null,
      needsDt: false,
      resetTimeOnInactive: false,
      buildInput: (ctx) => ({
        ...AnimationRenderLoop.buildFourPosTips(ctx.sharedTips, ctx.tipMap, "echo"),
        currentStep: ctx.params.currentStep,
        blueColor: ctx.params.trailSettings.blueColor,
        redColor: ctx.params.trailSettings.redColor,
      }),
      render: (r, cfg, inp) => r.renderFrame(cfg, inp),
    },
    // --- Bloom: array-of-tips, no dt ---
    {
      effect: "bloom",
      configKey: "bloomConfig",
      getRenderer: (l) => l.bloomRenderer as EffectRenderer | null,
      needsDt: false,
      resetTimeOnInactive: false,
      buildInput: (ctx) => AnimationRenderLoop.buildArrayTips(ctx.sharedTips, ctx.tipMap, "bloom", ctx.params, ctx.renderedTransforms),
      render: (r, cfg, inp) => r.renderFrame(cfg, inp),
    },
    // --- Water: 4-pos, dt, resetTimeOnInactive ---
    {
      effect: "water",
      configKey: "waterConfig",
      getRenderer: (l) => l.waterRenderer as EffectRenderer | null,
      needsDt: true,
      resetTimeOnInactive: true,
      buildInput: (ctx) => AnimationRenderLoop.buildFourPosTips(ctx.sharedTips, ctx.tipMap, "water"),
      render: (r, cfg, inp, dt) => r.renderFrame(cfg, inp, dt),
    },
    // --- Bubbles: 4-pos, dt, resetTimeOnInactive ---
    {
      effect: "bubbles",
      configKey: "bubblesConfig",
      getRenderer: (l) => l.bubblesRenderer as EffectRenderer | null,
      needsDt: true,
      resetTimeOnInactive: true,
      buildInput: (ctx) => AnimationRenderLoop.buildFourPosTips(ctx.sharedTips, ctx.tipMap, "bubbles"),
      render: (r, cfg, inp, dt) => r.renderFrame(cfg, inp, dt),
    },
    // --- Petals: 4-pos, dt, resetTimeOnInactive ---
    {
      effect: "petals",
      configKey: "petalsConfig",
      getRenderer: (l) => l.petalsRenderer as EffectRenderer | null,
      needsDt: true,
      resetTimeOnInactive: true,
      buildInput: (ctx) => AnimationRenderLoop.buildFourPosTips(ctx.sharedTips, ctx.tipMap, "petals"),
      render: (r, cfg, inp, dt) => r.renderFrame(cfg, inp, dt),
    },
    // --- Smoke: 4-pos, dt, resetTimeOnInactive ---
    {
      effect: "smoke",
      configKey: "smokeConfig",
      getRenderer: (l) => l.smokeRenderer as EffectRenderer | null,
      needsDt: true,
      resetTimeOnInactive: true,
      buildInput: (ctx) => AnimationRenderLoop.buildFourPosTips(ctx.sharedTips, ctx.tipMap, "smoke"),
      render: (r, cfg, inp, dt) => r.renderFrame(cfg, inp, dt),
    },
    // --- Ink: 4-pos, dt, resetTimeOnInactive ---
    {
      effect: "ink",
      configKey: "inkConfig",
      getRenderer: (l) => l.inkRenderer as EffectRenderer | null,
      needsDt: true,
      resetTimeOnInactive: true,
      buildInput: (ctx) => AnimationRenderLoop.buildFourPosTips(ctx.sharedTips, ctx.tipMap, "ink"),
      render: (r, cfg, inp, dt) => r.renderFrame(cfg, inp, dt),
    },
    // --- Frost: 4-pos, dt, resetTimeOnInactive ---
    {
      effect: "frost",
      configKey: "frostConfig",
      getRenderer: (l) => l.frostRenderer as EffectRenderer | null,
      needsDt: true,
      resetTimeOnInactive: true,
      buildInput: (ctx) => AnimationRenderLoop.buildFourPosTips(ctx.sharedTips, ctx.tipMap, "frost"),
      render: (r, cfg, inp, dt) => r.renderFrame(cfg, inp, dt),
    },
    // --- Silk: 4-pos, dt, resetTimeOnInactive, loopDetected arg ---
    {
      effect: "silk",
      configKey: "silkConfig",
      getRenderer: (l) => l.silkRenderer as EffectRenderer | null,
      needsDt: true,
      resetTimeOnInactive: true,
      buildInput: (ctx) => AnimationRenderLoop.buildFourPosTips(ctx.sharedTips, ctx.tipMap, "silk"),
      render: (r, cfg, inp, dt, ctx) => r.renderFrame(cfg, inp, dt, ctx.loopDetectedThisFrame && ctx.isSeamlesslyLoopable),
    },
    // --- Pulse: array-of-tips, dt, resetTimeOnInactive, currentStep arg ---
    {
      effect: "pulse",
      configKey: "pulseConfig",
      getRenderer: (l) => l.pulseRenderer as EffectRenderer | null,
      needsDt: true,
      resetTimeOnInactive: true,
      buildInput: (ctx) => AnimationRenderLoop.buildArrayTips(ctx.sharedTips, ctx.tipMap, "pulse", ctx.params, ctx.renderedTransforms),
      render: (r, cfg, inp, dt, ctx) => r.renderFrame(cfg, inp, ctx.params.currentStep ?? 0, dt),
    },
  ];

  /**
   * Dispatch a single effect from the registry. Handles:
   *   - renderer existence + initialization check
   *   - config presence check
   *   - error-disabled check (circuit breaker)
   *   - dt computation (if needsDt)
   *   - buildInput → render call
   *   - error counting + auto-disable after threshold
   *   - inactive clear + time reset
   */
  private dispatchEffect(entry: EffectDispatchEntry, ctx: EffectDispatchContext): void {
    const renderer = entry.getRenderer(this);
    if (!renderer?.isInitialized()) return;

    const config = ctx.params[entry.configKey];
    const hasOverlay = this.fireTipTracker && config != null;

    if (hasOverlay && !this.effectDisabled.get(entry.effect)) {
      try {
        let dt = 0;
        if (entry.needsDt) {
          const lastTime = this.effectLastFrameTime.get(entry.effect) ?? 0;
          const rawDt = lastTime > 0 ? (ctx.currentTime - lastTime) / 1000 : 1 / 60;
          dt = Math.min(0.1, (!Number.isFinite(rawDt) || rawDt <= 0) ? 1 / 60 : rawDt);
          this.effectLastFrameTime.set(entry.effect, ctx.currentTime);
        }
        const input = entry.buildInput(ctx, dt);
        entry.render(renderer, config, input, dt, ctx);
        this.effectErrors.set(entry.effect, 0);
      } catch (error) {
        const count = (this.effectErrors.get(entry.effect) ?? 0) + 1;
        this.effectErrors.set(entry.effect, count);
        renderer.clear();

        if (count >= AnimationRenderLoop.EFFECT_ERROR_THRESHOLD) {
          this.effectDisabled.set(entry.effect, true);
          const err = error instanceof Error ? error : new Error(String(error));
          console.error(`[AnimationRenderLoop] ${entry.effect} effect disabled after repeated failures:`, err);
          if (this.onEffectError) {
            this.onEffectError(entry.effect, err);
          } else {
            effectErrorSignal.trigger(entry.effect, err);
          }
        } else {
          console.warn(
            `[AnimationRenderLoop] ${entry.effect} render error (attempt ${count}/${AnimationRenderLoop.EFFECT_ERROR_THRESHOLD}), resetting:`,
            error
          );
        }
      }
    } else if (!hasOverlay) {
      renderer.clear();
      if (entry.resetTimeOnInactive) {
        this.effectLastFrameTime.set(entry.effect, 0);
      }
    }
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
    const { trailSettings, isPlaying, virtualTime } = params;

    // Use virtual time if provided (export mode), otherwise fallback to RAF timestamp
    const effectiveTime = virtualTime ?? currentTime;

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
        effectiveTime
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
    const echoActive =
      params.echoConfig != null &&
      this.echoRenderer?.isInitialized() === true;
    const bloomActive =
      params.bloomConfig != null &&
      this.bloomRenderer?.isInitialized() === true;
    const waterActive =
      params.waterConfig != null &&
      this.waterRenderer?.isInitialized() === true;
    const bubblesActive =
      params.bubblesConfig != null &&
      this.bubblesRenderer?.isInitialized() === true;
    const petalsActive =
      params.petalsConfig != null &&
      this.petalsRenderer?.isInitialized() === true;
    const smokeActive =
      params.smokeConfig != null &&
      this.smokeRenderer?.isInitialized() === true;
    const inkActive =
      params.inkConfig != null &&
      this.inkRenderer?.isInitialized() === true;
    const frostActive =
      params.frostConfig != null &&
      this.frostRenderer?.isInitialized() === true;
    const silkActive =
      params.silkConfig != null &&
      this.silkRenderer?.isInitialized() === true;
    const pulseActive =
      params.pulseConfig != null &&
      this.pulseRenderer?.isInitialized() === true;

    // Active work: playing, effects running, background animating, or explicit render request
    const hasActiveWork =
      this.needsRender ||
      isPlaying ||
      backgroundTransitioning ||
      fireActive ||
      charcoalActive ||
      ledActive ||
      zapActive ||
      sparklesActive ||
      echoActive ||
      bloomActive ||
      waterActive ||
      bubblesActive ||
      petalsActive ||
      smokeActive ||
      inkActive ||
      frostActive ||
      silkActive ||
      pulseActive;

    // Trails alone (without active work) should not keep the loop alive forever.
    // Allow a grace period for initialization/texture loading, then auto-stop.
    // If trails are active in FADE mode, extend the idle threshold to allow
    // them to fade completely (at least twice the fade duration).
    const idleThreshold = trailsNeedContinuousRender && trailSettings.mode === TrailMode.FADE
      ? Math.max(AnimationRenderLoop.IDLE_STOP_THRESHOLD, Math.ceil((trailSettings.fadeDurationMs * 2) / 16))
      : AnimationRenderLoop.IDLE_STOP_THRESHOLD;

    if (hasActiveWork) {
      this.consecutiveIdleFrames = 0;
    } else {
      this.consecutiveIdleFrames++;
    }

    const shouldContinueLoop =
      hasActiveWork ||
      (trailsNeedContinuousRender &&
        this.consecutiveIdleFrames < idleThreshold);

    if (shouldContinueLoop) {
      this.render(params, effectiveTime);
      this.needsRender = false;
      // Only schedule next frame if not disposed
      if (!this.isDisposed) {
        this.rafId = requestAnimationFrame(this.renderLoop);
      } else {
        this.rafId = null;
      }
    } else {
      // Stop loop - triggerRender() will restart if needed
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
      trailSettings: rawTrailSettings,
      gridVisible,
      gridMode,
      letter,
      props,
      visibility,
    } = params;

    // Tail length is authored as "visible ring points at ~60fps render rate."
    // The path-cache pipeline uses fadeDurationMs for both read window and
    // fade rate, so scale fadeDurationMs up to honor tailLength - otherwise
    // a long tailLength in download/export mode would be clipped by the
    // legacy 2500ms default. The overlay reads ring-buffer directly by
    // tailLength; extending fadeDurationMs also slows its GPU decay so
    // visibly-long trails don't fade out mid-tail.
    const FRAME_MS_60 = 1000 / 60;
    const tailDurationMs = (rawTrailSettings.tailLength ?? 20) * FRAME_MS_60;
    const effectiveFadeDurationMs = Math.max(
      rawTrailSettings.fadeDurationMs,
      tailDurationMs,
    );
    const trailSettings: TrailSettings =
      effectiveFadeDurationMs === rawTrailSettings.fadeDurationMs
        ? rawTrailSettings
        : { ...rawTrailSettings, fadeDurationMs: effectiveFadeDurationMs };

    // Get turn tuple for glyph rendering
    const blueMotion = stepData?.motions?.blue;
    const redMotion = stepData?.motions?.red;
    const turnsTuple =
      blueMotion && redMotion ? `${blueMotion.turns}${redMotion.turns}` : null;

    if (this.loopStartTime === 0) {
      this.loopStartTime = currentTime;
    }

    // Gather trail points. When the trail overlay is active (chaining mode),
    // disable seamless loop wrap-around - the overlay accumulates pixels
    // across sequences, so wrap-around would draw the loop-back path on
    // top of the next sequence's trail.
    const effectiveLoopable = this.trailOverlay
      ? false
      : (params.isSeamlesslyLoopable ?? false);
    const trailPoints = this.gatherTrailPoints(currentStep, trailSettings, effectiveLoopable, params.tipEffectMap);

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
        const trailCanvas = (this.trailOverlay as ITrailOverlayCanvas & { canvas?: HTMLCanvasElement }).canvas;
        if (trailCanvas) {
          const ctx = trailCanvas.getContext("2d");
          if (ctx) ctx.clearRect(0, 0, trailCanvas.width, trailCanvas.height);
        }
      }
      // Clear all registry effect overlays (Canvas2D)
      for (const entry of this.effectDispatchRegistry) {
        const renderer = entry.getRenderer(this);
        if (renderer?.isInitialized()) renderer.clear();
      }
    } else if (!params.suppress2DOverlays && this.wasSuppressed) {
      this.wasSuppressed = false;
    }

    // Route trail rendering through the overlay canvas
    if (this.trailOverlay && effectiveTrailsVisible && !params.suppress2DOverlays) {
      if (this.lastTrailFrameTime === 0) {
        this.trailOverlay.setVisible(true);
      }
      // Re-stamp only when (virtual) time has advanced. During export the
      // render loop ticks multiple times at the SAME virtualTime — one
      // calculateStateForStep sets the position, then several rAF ticks fire
      // while the frame is composited/encoded. On those repeat ticks dt is 0,
      // so there is no fade, yet advanceAccumulator would re-stamp the leading
      // edge at globalAlpha 1.0. Drawing the same semi-transparent line over
      // itself compounds it toward solid — the export "doubly opaque" trail
      // bug. The accumulator already holds this timestamp's stamp from the
      // first tick, so skip the duplicate. Live playback's rAF clock always
      // advances, so this is a no-op there.
      const isDuplicateTimestamp =
        this.lastStampedTrailTime !== null &&
        currentTime === this.lastStampedTrailTime;
      if (isDuplicateTimestamp) {
        // No new stamp this tick; visible trail canvas keeps the first-tick
        // composite, which the exporter reads.
      } else {
      const dt = this.lastTrailFrameTime > 0
        ? (currentTime - this.lastTrailFrameTime) / 1000
        : 1 / 60;
      this.lastTrailFrameTime = currentTime;
      this.lastStampedTrailTime = currentTime;

      this.trailOverlay.renderFrame({
        blueTrailPoints: effectiveBlueMotionVisible ? trailPoints.blue : [],
        redTrailPoints: effectiveRedMotionVisible ? trailPoints.red : [],
        trailSettings,
        deltaTime: dt,
        currentTime: currentTime,
        canvasSize: this.canvasSize,
        hasBlue: !!params.props.blueProp && effectiveBlueMotionVisible,
        hasRed: !!params.props.redProp && effectiveRedMotionVisible,
        additionalLayers: additionalLayerRenderData.length > 0 ? additionalLayerRenderData : undefined,
        blueProp: params.props.blueProp,
        redProp: params.props.redProp,
        bluePropType: params.bluePropType,
        redPropType: params.redPropType,
        tipEffectMap: params.tipEffectMap,
      });
      }
    } else if (this.trailOverlay && !effectiveTrailsVisible && this.lastTrailFrameTime > 0) {
      this.trailOverlay.clear();
      this.trailOverlay.setVisible(false);
      this.lastTrailFrameTime = 0;
      this.lastStampedTrailTime = null;
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
    const hasFireOrCharcoalOverlay = this.fireTipTracker && (
      (activeFireRenderer && params.fireConfig != null) || activeCharcoalRenderer
    );
    const hasAnyRegistryOverlay = this.fireTipTracker && this.effectDispatchRegistry.some(entry => {
      const renderer = entry.getRenderer(this);
      return renderer?.isInitialized() && params[entry.configKey] != null;
    });
    const hasAnyTipOverlay = hasFireOrCharcoalOverlay || hasAnyRegistryOverlay;

    let sharedTipResult: FireTipUpdateResult | null = null;
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
        effectiveBlueMotionVisible ? props.blueProp : null,
        effectiveRedMotionVisible ? props.redProp : null,
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

        const fireInput: FireFrameInput = {
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



    // Registry-driven dispatch: replaces 12 individual effect blocks
    // (sparkles, echo, bloom, water, bubbles, petals, smoke, ink, frost, silk, pulse)
    // with a single loop over the dispatch registry.
    if (!params.suppress2DOverlays && sharedTipResult) {
      const tipMap = params.tipEffectMap ?? {};
      const ctx: EffectDispatchContext = {
        tipMap,
        sharedTips: sharedTipResult.tips,
        params,
        currentTime,
        renderedTransforms,
        loopDetectedThisFrame: this.loopDetectedThisFrame,
        isSeamlesslyLoopable: params.isSeamlesslyLoopable ?? false,
      };
      for (const entry of this.effectDispatchRegistry) {
        this.dispatchEffect(entry, ctx);
      }
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

    // Rolling 1-second FPS summary - complements the per-drop log by telling
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

  private static compactByTrailFlag(points: TrailPoint[], tipMap: TipEffectMap): void {
    let w = 0;
    for (let i = 0; i < points.length; i++) {
      const pt = points[i]!;
      if (resolveEffect(pt.propIndex, pt.tipIndex, tipMap, {}) === "trails") {
        points[w++] = pt;
      }
    }
    points.length = w;
  }

  private gatherTrailPoints(
    currentStep: number,
    trailSettings: TrailSettings,
    isSeamlesslyLoopable: boolean,
    tipEffectMap?: TipEffectMap,
  ): {
    blue: TrailPoint[];
    red: TrailPoint[];
    additionalLayers: Array<{ blue: TrailPoint[]; red: TrailPoint[] }>;
  } {
    // CRITICAL: Reuse arrays to prevent GC pressure on mobile
    // Clear arrays without deallocating (length = 0 keeps capacity)
    this.reusableBlueTrailPoints.length = 0;
    this.reusableRedTrailPoints.length = 0;

    // Per-tip trail flags: only gather points for tips assigned "trails".
    // When no map is provided, default to gathering all tips.
    const tipMap = tipEffectMap ?? {};
    const hasAnyTrailEntry = Object.keys(tipMap).length > 0;
    const blueTip0Trails = !hasAnyTrailEntry || resolveEffect(0, 0, tipMap, {}) === "trails";
    const blueTip1Trails = !hasAnyTrailEntry || resolveEffect(0, 1, tipMap, {}) === "trails";
    const redTip0Trails = !hasAnyTrailEntry || resolveEffect(1, 0, tipMap, {}) === "trails";
    const redTip1Trails = !hasAnyTrailEntry || resolveEffect(1, 1, tipMap, {}) === "trails";

    // Detect animation loop (currentStep jumps backward significantly)
    // This happens when the sequence repeats from the beginning
    const LOOP_DETECTION_THRESHOLD = 0.5; // steps
    this.loopDetectedThisFrame = false;
    if (this.previousStep - currentStep > LOOP_DETECTION_THRESHOLD) {
      this.loopDetectedThisFrame = true;
      this.hasLoopedAtLeastOnce = true;
      // For non-seamless loops, record where the loop occurred to clamp trail start.
      // For seamless loops, don't clamp - trails wrap around the boundary.
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
        // Only wrap if a loop has actually occurred - on initial play there's
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

          // Blue prop: tail segment + head segment, filtered by per-tip trail flags
          let blueCount = 0;
          if (blueTip0Trails) {
            blueCount += this.pathCache.fillTrailPoints(
              0, 0, wrapStartStep, cacheEndStep, scaleFactor,
              this.reusableBlueTrailPoints, blueCount
            );
          }
          if (blueTip1Trails) {
            blueCount += this.pathCache.fillTrailPoints(
              0, 1, wrapStartStep, cacheEndStep, scaleFactor,
              this.reusableBlueTrailPoints, blueCount
            );
          }
          if (blueTip0Trails) {
            blueCount += this.pathCache.fillTrailPoints(
              0, 0, 0, currentStep, scaleFactor,
              this.reusableBlueTrailPoints, blueCount
            );
          }
          if (blueTip1Trails) {
            blueCount += this.pathCache.fillTrailPoints(
              0, 1, 0, currentStep, scaleFactor,
              this.reusableBlueTrailPoints, blueCount
            );
          }
          this.reusableBlueTrailPoints.length = blueCount;

          // Red prop: tail segment + head segment, filtered by per-tip trail flags
          let redCount = 0;
          if (redTip0Trails) {
            redCount += this.pathCache.fillTrailPoints(
              1, 0, wrapStartStep, cacheEndStep, scaleFactor,
              this.reusableRedTrailPoints, redCount
            );
          }
          if (redTip1Trails) {
            redCount += this.pathCache.fillTrailPoints(
              1, 1, wrapStartStep, cacheEndStep, scaleFactor,
              this.reusableRedTrailPoints, redCount
            );
          }
          if (redTip0Trails) {
            redCount += this.pathCache.fillTrailPoints(
              1, 0, 0, currentStep, scaleFactor,
              this.reusableRedTrailPoints, redCount
            );
          }
          if (redTip1Trails) {
            redCount += this.pathCache.fillTrailPoints(
              1, 1, 0, currentStep, scaleFactor,
              this.reusableRedTrailPoints, redCount
            );
          }
          this.reusableRedTrailPoints.length = redCount;
        } else {
          // NORMAL PATH (non-seamless, or seamless but trail doesn't cross boundary yet)
          let startStep = Math.max(0, desiredStart);

          // For non-seamless loops, clamp at loop point to prevent stale trail artifacts
          if (this.loopOccurredAtStep !== null) {
            startStep = Math.max(startStep, this.loopOccurredAtStep);
          }

          // Blue prop trails, filtered by per-tip trail flags
          let blueCount = 0;
          if (blueTip0Trails) {
            blueCount += this.pathCache.fillTrailPoints(
              0, 0, startStep, currentStep, scaleFactor,
              this.reusableBlueTrailPoints, blueCount
            );
          }
          if (blueTip1Trails) {
            blueCount += this.pathCache.fillTrailPoints(
              0, 1, startStep, currentStep, scaleFactor,
              this.reusableBlueTrailPoints, blueCount
            );
          }
          this.reusableBlueTrailPoints.length = blueCount;

          // Red prop trails, filtered by per-tip trail flags
          let redCount = 0;
          if (redTip0Trails) {
            redCount += this.pathCache.fillTrailPoints(
              1, 0, startStep, currentStep, scaleFactor,
              this.reusableRedTrailPoints, redCount
            );
          }
          if (redTip1Trails) {
            redCount += this.pathCache.fillTrailPoints(
              1, 1, startStep, currentStep, scaleFactor,
              this.reusableRedTrailPoints, redCount
            );
          }
          this.reusableRedTrailPoints.length = redCount;
        }
      }
    } else if (this.TrailCapturer && !this.trailOverlay) {
      // Fallback to real-time capture - only when NOT using the overlay.
      // The overlay accumulates pixels, so during the brief cache-rebuild
      // gap it's better to draw nothing (existing pixels fade naturally)
      // than to draw broken real-time capture points as artifacts.
      this.TrailCapturer.fillTrailPointArrays(
        this.reusableBlueTrailPoints,
        this.reusableRedTrailPoints,
        this.reusableAdditionalLayerTrails
      );

      // Post-filter captured points by per-tip trail flags (allocation-free compact)
      if (hasAnyTrailEntry) {
        AnimationRenderLoop.compactByTrailFlag(this.reusableBlueTrailPoints, tipMap);
        AnimationRenderLoop.compactByTrailFlag(this.reusableRedTrailPoints, tipMap);
      }
    }

    return {
      blue: this.reusableBlueTrailPoints,
      red: this.reusableRedTrailPoints,
      additionalLayers: this.reusableAdditionalLayerTrails,
    };
  }
}
