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

import type { IAnimationRenderer as AnimationRenderer } from "$lib/shared/animation-engine/services/IAnimationRenderer";
import type { ITrailCapturer as TrailCapturer } from "$lib/shared/animation-engine/services/ITrailCapturer";
import type { TrailPoint, TrailSettings } from "../domain/types/trail-types";
import { TrailMode } from "../domain/types/trail-types";
import type { AnimationPathCache } from "$lib/shared/animation-engine/services/animation-path-cache";
import type { FrameBudgetMonitor } from '$lib/shared/animation-engine/services/frame-budget-monitor'
import type { WebGLFireRenderer } from "./fire/web-gl-fire-renderer";
import type { CharcoalSparkRenderer } from "./charcoal/charcoal-spark-renderer";
import type { RenderedPropTransform, PropTipData } from "../domain/types/fire-types";
import type { FireTipTrackerConfig } from "./fire-tip-tracker";
import type { FireTipTracker } from "./fire-tip-tracker";
import type { WebGLLedRenderer } from '$lib/shared/animation-engine/services/led/web-gl-led-renderer'
import type { LedTipTrackerConfig } from "./led-tip-tracker";
import type { LedTipTracker } from "./led-tip-tracker";
import type { ITrailOverlayCanvas } from "./ITrailOverlayCanvas";
import type {
  RenderLoopConfig,
  RenderFrameParams,
} from "./IAnimationRenderLoop";
import type { EffectRendererLike } from "./effects/effect-renderer";
import { QualityTier } from "../domain/types/quality-types";
import { effectErrorSignal } from "../state/effect-error-signal.svelte";
import { resolveEffect } from "../domain/types/tip-effect-types";
import type { EffectType, TipEffectMap } from "../domain/types/tip-effect-types";
import type { FireTipUpdateResult } from './fire-tip-tracker';
import type { FireFrameInput } from '../domain/types/fire-types';

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
  private fireTipTracker: FireTipTracker | null = null;
  private ledTipTracker: LedTipTracker | null = null;
  private onEffectError: ((effectName: string, error: Error) => void) | null = null;
  /**
   * Registry-driven renderer map. Keyed by EffectType id.
   * Populated/updated via initialize() and updateConfig().
   * Replaces the 16 hand-typed named renderer fields from pre-P2.4.
   */
  private renderers = new Map<EffectType, EffectRendererLike>();
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
    this.fireTipTracker = config.fireTipTracker ?? null;
    this.ledTipTracker = config.ledTipTracker ?? null;
    this.onEffectError = config.onEffectError ?? null;

    // Merge the initial renderers record into the Map.
    if (config.renderers) {
      for (const [id, renderer] of Object.entries(config.renderers)) {
        if (renderer != null) {
          this.renderers.set(id as EffectType, renderer);
        }
      }
    }

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
    if (config.fireTipTracker !== undefined)
      this.fireTipTracker = config.fireTipTracker ?? null;
    if (config.ledTipTracker !== undefined)
      this.ledTipTracker = config.ledTipTracker ?? null;
    if (config.onEffectError !== undefined)
      this.onEffectError = config.onEffectError ?? null;
    // Merge renderer additions/removals from the registry record.
    if (config.renderers !== undefined) {
      for (const [id, renderer] of Object.entries(config.renderers as Record<string, EffectRendererLike | null | undefined>)) {
        if (renderer != null) {
          this.renderers.set(id as EffectType, renderer);
        } else {
          this.renderers.delete(id as EffectType);
        }
      }
    }
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

  /** Render ONE frame synchronously, now, with an explicit sim dt (seconds).
   *  Bypasses rAF/needsRender scheduling — used by the offscreen export path so
   *  rendering is deterministic. The free-running loop is never started. */
  renderSync(params: RenderFrameParams, timeMs: number, dtSeconds: number): void {
    this.render(params, timeMs, dtSeconds);
  }

  setTargetFps(_fps: number | null): void {
    // No-op: FPS throttling removed - time-based animation interpolation
    // makes frame rate differences imperceptible in the preview.
    // FPS setting only affects the exported video file.
  }

  /** Snapshot of render loop state for diagnostic reports. */
  getDiagnostics(): Record<string, unknown> {
    const fireRenderer = this.renderers.get("fire") as (WebGLFireRenderer & { getDiagnostics?: () => unknown }) | undefined;
    const charcoalRenderer = this.renderers.get("charcoal");
    const ledRenderer = this.renderers.get("led");
    const trailOverlay = this.renderers.get("trails");
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
      fireRendererInitialized: fireRenderer?.isInitialized() ?? false,
      charcoalRendererInitialized: charcoalRenderer?.isInitialized() ?? false,
      ledRendererInitialized: ledRenderer?.isInitialized() ?? false,
      hasTrailOverlay: !!trailOverlay,
      fireTipDiagnostics: this.fireTipTracker?.getDiagnostics?.() ?? null,
      fireRendererDiagnostics: fireRenderer?.getDiagnostics?.() ?? null,
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
    this.fireTipTracker = null;
    this.ledTipTracker = null;
    // Dispose all renderers in the registry map.
    // AnimationRenderLoop does not own the renderers' DOM canvas elements
    // (EffectRendererManager owns those); we only hold the reference.
    // Clear the map without calling dispose() here — callers that own the
    // renderers (EffectRendererManager.dispose()) will call dispose() on them.
    this.renderers.clear();
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
      getRenderer: (l) => (l.renderers.get("zap") ?? null) as EffectRenderer | null,
      needsDt: false,
      resetTimeOnInactive: false,
      buildInput: (ctx) => AnimationRenderLoop.buildFourPosTips(ctx.sharedTips, ctx.tipMap, "zap"),
      render: (r, cfg, inp) => r.renderFrame(cfg, inp),
    },
    // --- Sparkles: 4-pos, dt ---
    {
      effect: "sparkles",
      configKey: "sparklesConfig",
      getRenderer: (l) => (l.renderers.get("sparkles") ?? null) as EffectRenderer | null,
      needsDt: true,
      resetTimeOnInactive: false,
      buildInput: (ctx) => AnimationRenderLoop.buildFourPosTips(ctx.sharedTips, ctx.tipMap, "sparkles"),
      render: (r, cfg, inp, dt) => r.renderFrame(cfg, inp, dt),
    },
    // --- Echo: 4-pos + currentStep + colors, no dt ---
    {
      effect: "echo",
      configKey: "echoConfig",
      getRenderer: (l) => (l.renderers.get("echo") ?? null) as EffectRenderer | null,
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
      getRenderer: (l) => (l.renderers.get("bloom") ?? null) as EffectRenderer | null,
      needsDt: false,
      resetTimeOnInactive: false,
      buildInput: (ctx) => AnimationRenderLoop.buildArrayTips(ctx.sharedTips, ctx.tipMap, "bloom", ctx.params, ctx.renderedTransforms),
      render: (r, cfg, inp) => r.renderFrame(cfg, inp),
    },
    // --- Water: 4-pos, dt, resetTimeOnInactive ---
    {
      effect: "water",
      configKey: "waterConfig",
      getRenderer: (l) => (l.renderers.get("water") ?? null) as EffectRenderer | null,
      needsDt: true,
      resetTimeOnInactive: true,
      buildInput: (ctx) => AnimationRenderLoop.buildFourPosTips(ctx.sharedTips, ctx.tipMap, "water"),
      render: (r, cfg, inp, dt) => r.renderFrame(cfg, inp, dt),
    },
    // --- Bubbles: 4-pos, dt, resetTimeOnInactive ---
    {
      effect: "bubbles",
      configKey: "bubblesConfig",
      getRenderer: (l) => (l.renderers.get("bubbles") ?? null) as EffectRenderer | null,
      needsDt: true,
      resetTimeOnInactive: true,
      buildInput: (ctx) => AnimationRenderLoop.buildFourPosTips(ctx.sharedTips, ctx.tipMap, "bubbles"),
      render: (r, cfg, inp, dt) => r.renderFrame(cfg, inp, dt),
    },
    // --- Petals: 4-pos, dt, resetTimeOnInactive ---
    {
      effect: "petals",
      configKey: "petalsConfig",
      getRenderer: (l) => (l.renderers.get("petals") ?? null) as EffectRenderer | null,
      needsDt: true,
      resetTimeOnInactive: true,
      buildInput: (ctx) => AnimationRenderLoop.buildFourPosTips(ctx.sharedTips, ctx.tipMap, "petals"),
      render: (r, cfg, inp, dt) => r.renderFrame(cfg, inp, dt),
    },
    // --- Smoke: 4-pos, dt, resetTimeOnInactive ---
    {
      effect: "smoke",
      configKey: "smokeConfig",
      getRenderer: (l) => (l.renderers.get("smoke") ?? null) as EffectRenderer | null,
      needsDt: true,
      resetTimeOnInactive: true,
      buildInput: (ctx) => AnimationRenderLoop.buildFourPosTips(ctx.sharedTips, ctx.tipMap, "smoke"),
      render: (r, cfg, inp, dt) => r.renderFrame(cfg, inp, dt),
    },
    // --- Ink: 4-pos, dt, resetTimeOnInactive ---
    {
      effect: "ink",
      configKey: "inkConfig",
      getRenderer: (l) => (l.renderers.get("ink") ?? null) as EffectRenderer | null,
      needsDt: true,
      resetTimeOnInactive: true,
      buildInput: (ctx) => AnimationRenderLoop.buildFourPosTips(ctx.sharedTips, ctx.tipMap, "ink"),
      render: (r, cfg, inp, dt) => r.renderFrame(cfg, inp, dt),
    },
    // --- Frost: 4-pos, dt, resetTimeOnInactive ---
    {
      effect: "frost",
      configKey: "frostConfig",
      getRenderer: (l) => (l.renderers.get("frost") ?? null) as EffectRenderer | null,
      needsDt: true,
      resetTimeOnInactive: true,
      buildInput: (ctx) => AnimationRenderLoop.buildFourPosTips(ctx.sharedTips, ctx.tipMap, "frost"),
      render: (r, cfg, inp, dt) => r.renderFrame(cfg, inp, dt),
    },
    // --- Silk: 4-pos, dt, resetTimeOnInactive, loopDetected arg ---
    {
      effect: "silk",
      configKey: "silkConfig",
      getRenderer: (l) => (l.renderers.get("silk") ?? null) as EffectRenderer | null,
      needsDt: true,
      resetTimeOnInactive: true,
      buildInput: (ctx) => AnimationRenderLoop.buildFourPosTips(ctx.sharedTips, ctx.tipMap, "silk"),
      render: (r, cfg, inp, dt, ctx) => r.renderFrame(cfg, inp, dt, ctx.loopDetectedThisFrame && ctx.isSeamlesslyLoopable),
    },
    // --- Pulse: array-of-tips, dt, resetTimeOnInactive, currentStep arg ---
    {
      effect: "pulse",
      configKey: "pulseConfig",
      getRenderer: (l) => (l.renderers.get("pulse") ?? null) as EffectRenderer | null,
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

    // Build a per-effect active map using the exact same gating semantics as before:
    //   fire:     params.fireConfig != null && renderer.isInitialized()
    //   charcoal: params.fireConfig != null && renderer.isInitialized()  (shares fireConfig gate)
    //   led:      params.ledConfig?.enabled === true && renderer.isInitialized()
    //   trails:   gated separately below (hasTrailTips + mode check)
    //   all 12 canvas2d effects: params.{id}Config != null && renderer.isInitialized()
    const activeByEffect = new Map<EffectType, boolean>();
    const paramsAsRecord = params as unknown as Record<string, unknown>;
    for (const entry of this.effectDispatchRegistry) {
      const renderer = entry.getRenderer(this);
      const cfgPresent = paramsAsRecord[entry.configKey] != null;
      activeByEffect.set(entry.effect, cfgPresent && renderer?.isInitialized() === true);
    }
    // Special gates for fire, charcoal, led (not in effectDispatchRegistry)
    const fireActive =
      params.fireConfig != null &&
      (this.renderers.get("fire")?.isInitialized() === true);
    const charcoalActive =
      params.fireConfig != null &&
      (this.renderers.get("charcoal")?.isInitialized() === true);
    const ledActive =
      params.ledConfig?.enabled === true &&
      (this.renderers.get("led")?.isInitialized() === true);

    const anyRegistryActive = [...activeByEffect.values()].some(Boolean);
    const anyEffectActive = anyRegistryActive || fireActive || charcoalActive || ledActive;

    // Active work: playing, effects running, background animating, or explicit render request
    const hasActiveWork =
      this.needsRender ||
      isPlaying ||
      backgroundTransitioning ||
      anyEffectActive;

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

  // providedDtSeconds: explicit sim timestep for deterministic (export) render.
  // When omitted (live), derive it from the rAF-to-rAF gap so behavior is
  // byte-identical to the renderers' previous wall-clock fallback.
  private render(
    params: RenderFrameParams,
    currentTime: number,
    providedDtSeconds?: number,
  ): void {
    if (!this.renderer) return;

    // Measure RAF-to-RAF gap (includes browser layout, GC, other JS, vsync wait)
    const rafGap = this.lastFrameTime > 0 ? currentTime - this.lastFrameTime : 0;
    this.lastFrameTime = currentTime;

    const dtSeconds = providedDtSeconds ?? (rafGap > 0 ? rafGap / 1000 : 0.016);

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
    const effectiveLoopable = this.renderers.has("trails")
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
      // Clear WebGL overlay canvases (fire, charcoal, led) so stale frames don't show through
      for (const id of ["fire", "charcoal", "led"] as EffectType[]) {
        const r = this.renderers.get(id) as (EffectRendererLike & { getCanvas?: () => HTMLCanvasElement | null }) | undefined;
        if (!r?.isInitialized()) continue;
        const canvas = r.getCanvas?.();
        if (!canvas) continue;
        const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
        if (gl) gl.clear(gl.COLOR_BUFFER_BIT);
      }
      // Clear trail overlay (Canvas2D)
      const trailOverlayRenderer = this.renderers.get("trails") as (ITrailOverlayCanvas & { canvas?: HTMLCanvasElement }) | undefined;
      if (trailOverlayRenderer) {
        const trailCanvas = trailOverlayRenderer.canvas;
        if (trailCanvas) {
          const ctx2d = trailCanvas.getContext("2d");
          if (ctx2d) ctx2d.clearRect(0, 0, trailCanvas.width, trailCanvas.height);
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
    const trailOverlay = this.renderers.get("trails") as ITrailOverlayCanvas | undefined;
    if (trailOverlay && effectiveTrailsVisible && !params.suppress2DOverlays) {
      if (this.lastTrailFrameTime === 0) {
        trailOverlay.setVisible(true);
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

      trailOverlay.renderFrame({
        blueTrailPoints: effectiveBlueMotionVisible ? trailPoints.blue : [],
        redTrailPoints: effectiveRedMotionVisible ? trailPoints.red : [],
        trailSettings,
        deltaTime: dt,
        currentTime: currentTime,
        canvasSize: this.canvasSize,
        hasBlue: !!params.props.blueProp && effectiveBlueMotionVisible,
        hasRed: !!params.props.redProp && effectiveRedMotionVisible,
        additionalLayers: additionalLayerRenderData.length > 0 ? additionalLayerRenderData : undefined,
        tunnelSpectrum: props.tunnelSpectrum,
        blueProp: params.props.blueProp,
        redProp: params.props.redProp,
        bluePropType: params.bluePropType,
        redPropType: params.redPropType,
        tipEffectMap: params.tipEffectMap,
        loopDetected: this.loopDetectedThisFrame,
        isSeamlesslyLoopable: params.isSeamlesslyLoopable ?? false,
      });
      }
    } else if (trailOverlay && !effectiveTrailsVisible && this.lastTrailFrameTime > 0) {
      trailOverlay.clear();
      trailOverlay.setVisible(false);
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
      skipTrailRendering: this.renderers.has("trails"),
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
    const activeFireRenderer = (this.renderers.get("fire") as WebGLFireRenderer | undefined)?.isInitialized()
      ? (this.renderers.get("fire") as WebGLFireRenderer)
      : null;
    const activeCharcoalRenderer = (this.renderers.get("charcoal") as CharcoalSparkRenderer | undefined)?.isInitialized()
      ? (this.renderers.get("charcoal") as CharcoalSparkRenderer)
      : null;
    const hasFireOrCharcoalOverlay = this.fireTipTracker && (
      (activeFireRenderer && params.fireConfig != null) || activeCharcoalRenderer
    );
    const hasAnyRegistryOverlay = this.fireTipTracker && this.effectDispatchRegistry.some(entry => {
      const renderer = entry.getRenderer(this);
      return renderer?.isInitialized() && (params as unknown as Record<string, unknown>)[entry.configKey] != null;
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
        // Overlaid tunnel layers get tips too, so per-tip effects cover every
        // copy in the kaleidoscope (not just the base pair). Absent for normal
        // single-sequence playback → identical legacy behavior.
        additionalLayers:
          props.additionalLayers.length > 0
            ? props.additionalLayers.map((l) => ({
                blueProp: effectiveBlueMotionVisible ? l.blueProp : null,
                redProp: effectiveRedMotionVisible ? l.redProp : null,
              }))
            : undefined,
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
          dt: dtSeconds,
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
    const activeLedRenderer = (this.renderers.get("led") as WebGLLedRenderer | undefined)?.isInitialized()
      ? (this.renderers.get("led") as WebGLLedRenderer)
      : null;
    if (
      activeLedRenderer &&
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
          // LEDs cover overlaid tunnel layers too (parity with fire/charcoal).
          additionalLayers:
            props.additionalLayers.length > 0
              ? props.additionalLayers.map((l) => ({
                  blueProp: l.blueProp,
                  redProp: l.redProp,
                }))
              : undefined,
          tunnelSpectrum: props.tunnelSpectrum ?? true,
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
          activeLedRenderer.renderLeds(
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
        const fireRenderer = this.renderers.get("fire") as WebGLFireRenderer | undefined;
        if (fireRenderer?.isInitialized()) {
          // Map quality tier → fire simulation quality level
          const fireQuality = hints.tier === QualityTier.HIGH ? 3
            : hints.tier === QualityTier.MEDIUM ? 2
            : 1;
          fireRenderer.setQuality(fireQuality);
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
        const fireState = this.renderers.get("fire")?.isInitialized()
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
        const fireState = this.renderers.get("fire")?.isInitialized()
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
    } else if (this.TrailCapturer && !this.renderers.has("trails")) {
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

    // Overlaid tunnel-layer trails ALWAYS come from the live capturer. The path
    // cache only stores base prop paths, and the real-time fallback above is
    // gated off while the trails overlay is active — so without this, layer
    // trails vanish exactly when trails is the chosen effect. Downstream gating
    // (effectiveTrailsVisible) hides these when trails isn't active, so filling
    // unconditionally here is safe.
    if (this.TrailCapturer) {
      this.TrailCapturer.fillAdditionalLayerTrails(this.reusableAdditionalLayerTrails);
    } else {
      this.reusableAdditionalLayerTrails.length = 0;
    }

    return {
      blue: this.reusableBlueTrailPoints,
      red: this.reusableRedTrailPoints,
      additionalLayers: this.reusableAdditionalLayerTrails,
    };
  }
}
