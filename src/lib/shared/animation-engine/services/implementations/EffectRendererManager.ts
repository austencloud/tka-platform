/**
 * EffectRendererManager
 *
 * Owns all 15 effect overlay renderers (fire, charcoal, LED, zap, sparkles,
 * echo, bloom, water, bubbles, petals, smoke, ink, frost, silk, pulse).
 * Handles initialize/destroy lifecycle, config sync, and layer ordering.
 *
 * Extracted from AnimationEngine to reduce its line count.
 * This is a plain TypeScript class - no Svelte reactivity needed.
 */

import type { FireTipTracker } from "./FireTipTracker";

import type { LedTipTracker } from "./LedTipTracker";
import type { ITrailOverlayCanvas } from "../contracts/ITrailOverlayCanvas";

import type { IAnimationRenderLoop } from "../contracts/IAnimationRenderLoop";
import type { EffectType, TipEffectMap, TipEffortMap } from "../../domain/types/TipEffectTypes";
import type { FireOverlayConfig } from "../../domain/types/FireTypes";
import { DEFAULT_FIRE_CONFIG } from "../../domain/types/FireTypes";
import type { LedOverlayConfig } from "../../domain/types/LedTypes";
import { DEFAULT_LED_CONFIG, ledBrightnessToFloat } from "../../domain/types/LedTypes";
import { resolveEffectZ } from "../effect-layer";
import type { AnimationVisibilityStateManager } from "../../state/animation-visibility-state.svelte";
import type { CharcoalSparkParams } from "../../domain/types/CharcoalSparkTypes";
import { semanticToCharcoalParams } from "../../domain/types/CharcoalSparkTypes";
import type { EffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
import type { RenderFrameParams, RenderLoopConfig } from "../contracts/IAnimationRenderLoop";

import { WebGLFireRenderer } from "./fire/WebGLFireRenderer";
import { CharcoalSparkRenderer } from "./charcoal/CharcoalSparkRenderer";
import { WebGLLedRenderer } from "./led/WebGLLedRenderer";
import { ZapOverlayRenderer } from "./ZapOverlayRenderer";
import { SparklesOverlayRenderer } from "./SparklesOverlayRenderer";
import { EchoOverlayRenderer } from "./EchoOverlayRenderer";
import { BloomOverlayRenderer } from "./BloomOverlayRenderer";
import { WaterOverlayRenderer } from "./WaterOverlayRenderer";
import { BubblesOverlayRenderer } from "./BubblesOverlayRenderer";
import { PetalsOverlayRenderer } from "./PetalsOverlayRenderer";
import { SmokeOverlayRenderer } from "./SmokeOverlayRenderer";
import { InkOverlayRenderer } from "./InkOverlayRenderer";
import { FrostOverlayRenderer } from "./FrostOverlayRenderer";
import { SilkOverlayRenderer } from "./SilkOverlayRenderer";
import { PulseOverlayRenderer } from "./PulseOverlayRenderer";
import { TrailOverlayWebGL2 } from "./TrailOverlayWebGL2";
import { TrailOverlayCanvas } from "./TrailOverlayCanvas";

/** Callback to obtain current frame params (used to trigger re-renders). */
export type FrameParamsProvider = () => RenderFrameParams;

/** Minimal renderer interface shared by all overlay renderers. */
interface OverlayRenderer {
  initialize(container: HTMLElement, w: number, h: number): boolean;
  dispose(): void;
  isInitialized(): boolean;
  resize?(w: number, h: number): void;
  setCanvasZIndex?(z: number): void;
}

/** Registry entry describing one overlay effect's lifecycle. */
interface OverlayEffectEntry {
  /** Effect type name (matches EffectType union member). */
  effect: Exclude<EffectType, "none" | "led" | "trails">;
  /** Key on `this` where the renderer instance lives. */
  rendererField: keyof EffectRendererManager & string;
  /** Key on RenderLoopConfig for updateConfig(). */
  configKey: keyof RenderLoopConfig & string;
  /** Constructor to create the renderer. */
  RendererClass: new () => OverlayRenderer;
  /** Optional hook called after successful initialization. */
  onInit?: (mgr: EffectRendererManager, renderer: OverlayRenderer) => void;
  /** Optional hook called on disable (after dispose). */
  onDisable?: (mgr: EffectRendererManager) => void;
  /** If false, skip triggerRender() at end. Default true. */
  triggerRender?: boolean;
}

/** The 14 registry-driven overlay effects (LED excluded — unique lifecycle). */
const OVERLAY_REGISTRY: readonly OverlayEffectEntry[] = [
  {
    effect: "fire",
    rendererField: "fireRenderer",
    configKey: "fireRenderer",
    RendererClass: WebGLFireRenderer,
    onDisable: (mgr) => {
      if (!mgr.isEffectEnabled("charcoal")) {
        mgr.fireTipTracker?.reset();
      }
    },
  },
  {
    effect: "charcoal",
    rendererField: "charcoalRenderer",
    configKey: "charcoalRenderer",
    RendererClass: CharcoalSparkRenderer,
    onInit: (mgr, renderer) => {
      const charcoalParams = mgr.getCharcoalParamsFromConfig();
      if (charcoalParams) (renderer as CharcoalSparkRenderer).setParams(charcoalParams);
    },
    onDisable: (mgr) => {
      if (!mgr.isEffectEnabled("fire")) {
        mgr.fireTipTracker?.reset();
      }
    },
  },
  {
    effect: "zap",
    rendererField: "zapRenderer",
    configKey: "zapRenderer",
    RendererClass: ZapOverlayRenderer,
  },
  {
    effect: "sparkles",
    rendererField: "sparklesRenderer",
    configKey: "sparklesRenderer",
    RendererClass: SparklesOverlayRenderer,
  },
  {
    effect: "echo",
    rendererField: "echoRenderer",
    configKey: "echoRenderer",
    RendererClass: EchoOverlayRenderer,
  },
  {
    effect: "bloom",
    rendererField: "bloomRenderer",
    configKey: "bloomRenderer",
    RendererClass: BloomOverlayRenderer,
  },
  {
    effect: "water",
    rendererField: "waterRenderer",
    configKey: "waterRenderer",
    RendererClass: WaterOverlayRenderer,
  },
  {
    effect: "bubbles",
    rendererField: "bubblesRenderer",
    configKey: "bubblesRenderer",
    RendererClass: BubblesOverlayRenderer,
  },
  {
    effect: "petals",
    rendererField: "petalsRenderer",
    configKey: "petalsRenderer",
    RendererClass: PetalsOverlayRenderer,
  },
  {
    effect: "smoke",
    rendererField: "smokeRenderer",
    configKey: "smokeRenderer",
    RendererClass: SmokeOverlayRenderer,
  },
  {
    effect: "ink",
    rendererField: "inkRenderer",
    configKey: "inkRenderer",
    RendererClass: InkOverlayRenderer,
  },
  {
    effect: "frost",
    rendererField: "frostRenderer",
    configKey: "frostRenderer",
    RendererClass: FrostOverlayRenderer,
  },
  {
    effect: "silk",
    rendererField: "silkRenderer",
    configKey: "silkRenderer",
    RendererClass: SilkOverlayRenderer,
  },
  {
    effect: "pulse",
    rendererField: "pulseRenderer",
    configKey: "pulseRenderer",
    RendererClass: PulseOverlayRenderer,
  },
];

export class EffectRendererManager {
  // ── Renderer instances ──────────────────────────────────────────────
  fireRenderer: WebGLFireRenderer | null = null;
  charcoalRenderer: CharcoalSparkRenderer | null = null;
  fireTipTracker: FireTipTracker | null = null;
  ledRenderer: WebGLLedRenderer | null = null;
  ledTipTracker: LedTipTracker | null = null;
  trailOverlay: ITrailOverlayCanvas | null = null;
  zapRenderer: ZapOverlayRenderer | null = null;
  sparklesRenderer: SparklesOverlayRenderer | null = null;
  echoRenderer: EchoOverlayRenderer | null = null;
  bloomRenderer: BloomOverlayRenderer | null = null;
  waterRenderer: WaterOverlayRenderer | null = null;
  bubblesRenderer: BubblesOverlayRenderer | null = null;
  petalsRenderer: PetalsOverlayRenderer | null = null;
  smokeRenderer: SmokeOverlayRenderer | null = null;
  inkRenderer: InkOverlayRenderer | null = null;
  frostRenderer: FrostOverlayRenderer | null = null;
  silkRenderer: SilkOverlayRenderer | null = null;
  pulseRenderer: PulseOverlayRenderer | null = null;

  // ── Configs ─────────────────────────────────────────────────────────
  fireConfig: FireOverlayConfig = { ...DEFAULT_FIRE_CONFIG };
  ledConfig: LedOverlayConfig = { ...DEFAULT_LED_CONFIG };
  private ledInitPending = false;

  // ── Per-cell maps ───────────────────────────────────────────────────
  cellTipEffectMap: TipEffectMap | undefined = undefined;
  cellTipEffortMap: TipEffortMap | undefined = undefined;

  // ── Previous-frame flags for change detection ───────────────────────
  /** Map from effect name to whether tips are currently enabled. LED uses ledConfig.enabled instead. */
  private prevEffectEnabled: Map<OverlayEffectEntry["effect"], boolean> = new Map(
    OVERLAY_REGISTRY.map(e => [e.effect, false])
  );

  // Legacy accessors for external callers that read these flags directly
  get prevHasFireTips(): boolean { return this.prevEffectEnabled.get("fire") ?? false; }
  set prevHasFireTips(v: boolean) { this.prevEffectEnabled.set("fire", v); }
  get prevHasCharcoalTips(): boolean { return this.prevEffectEnabled.get("charcoal") ?? false; }
  set prevHasCharcoalTips(v: boolean) { this.prevEffectEnabled.set("charcoal", v); }
  get prevHasZapTips(): boolean { return this.prevEffectEnabled.get("zap") ?? false; }
  set prevHasZapTips(v: boolean) { this.prevEffectEnabled.set("zap", v); }
  get prevHasSparklesTips(): boolean { return this.prevEffectEnabled.get("sparkles") ?? false; }
  set prevHasSparklesTips(v: boolean) { this.prevEffectEnabled.set("sparkles", v); }
  get prevHasEchoTips(): boolean { return this.prevEffectEnabled.get("echo") ?? false; }
  set prevHasEchoTips(v: boolean) { this.prevEffectEnabled.set("echo", v); }
  get prevHasBloomTips(): boolean { return this.prevEffectEnabled.get("bloom") ?? false; }
  set prevHasBloomTips(v: boolean) { this.prevEffectEnabled.set("bloom", v); }
  get prevHasWaterTips(): boolean { return this.prevEffectEnabled.get("water") ?? false; }
  set prevHasWaterTips(v: boolean) { this.prevEffectEnabled.set("water", v); }
  get prevHasBubblesTips(): boolean { return this.prevEffectEnabled.get("bubbles") ?? false; }
  set prevHasBubblesTips(v: boolean) { this.prevEffectEnabled.set("bubbles", v); }
  get prevHasPetalsTips(): boolean { return this.prevEffectEnabled.get("petals") ?? false; }
  set prevHasPetalsTips(v: boolean) { this.prevEffectEnabled.set("petals", v); }
  get prevHasSmokeTips(): boolean { return this.prevEffectEnabled.get("smoke") ?? false; }
  set prevHasSmokeTips(v: boolean) { this.prevEffectEnabled.set("smoke", v); }
  get prevHasInkTips(): boolean { return this.prevEffectEnabled.get("ink") ?? false; }
  set prevHasInkTips(v: boolean) { this.prevEffectEnabled.set("ink", v); }
  get prevHasFrostTips(): boolean { return this.prevEffectEnabled.get("frost") ?? false; }
  set prevHasFrostTips(v: boolean) { this.prevEffectEnabled.set("frost", v); }
  get prevHasSilkTips(): boolean { return this.prevEffectEnabled.get("silk") ?? false; }
  set prevHasSilkTips(v: boolean) { this.prevEffectEnabled.set("silk", v); }
  get prevHasPulseTips(): boolean { return this.prevEffectEnabled.get("pulse") ?? false; }
  set prevHasPulseTips(v: boolean) { this.prevEffectEnabled.set("pulse", v); }

  // ── Dependencies (injected) ─────────────────────────────────────────
  private containerElement: HTMLDivElement | null = null;
  private canvasSize: number = 0;
  private renderLoopService: IAnimationRenderLoop | null = null;
  private getFrameParams: FrameParamsProvider | null = null;
  private getVM: (() => AnimationVisibilityStateManager) | null = null;
  effectsConfigState: EffectsConfigState | null = null;

  // ── Registry helpers (consolidate dynamic property access) ──────────
  private getOverlayRenderer(field: OverlayEffectEntry["rendererField"]): OverlayRenderer | null {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this as any)[field] as OverlayRenderer | null;
  }
  private setOverlayRenderer(field: OverlayEffectEntry["rendererField"], value: OverlayRenderer | null): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this as any)[field] = value;
  }

  /**
   * Wire dependencies after construction. Called once from AnimationEngine.initialize().
   */
  wire(deps: {
    containerElement: HTMLDivElement;
    canvasSize: number;
    renderLoopService: IAnimationRenderLoop | null;
    getFrameParams: FrameParamsProvider;
    getVM: () => AnimationVisibilityStateManager;
  }): void {
    this.containerElement = deps.containerElement;
    this.canvasSize = deps.canvasSize;
    this.renderLoopService = deps.renderLoopService;
    this.getFrameParams = deps.getFrameParams;
    this.getVM = deps.getVM;
  }

  /** Update mutable refs that change after wire() (e.g. renderLoopService set later). */
  updateRefs(refs: {
    renderLoopService?: IAnimationRenderLoop | null;
    canvasSize?: number;
  }): void {
    if (refs.renderLoopService !== undefined) this.renderLoopService = refs.renderLoopService;
    if (refs.canvasSize !== undefined) this.canvasSize = refs.canvasSize;
  }

  /** Expose charcoal params from EffectsConfigState for the registry onInit hook. */
  getCharcoalParamsFromConfig(): CharcoalSparkParams | undefined {
    if (!this.effectsConfigState) return undefined;
    const { intensity, spread, glow, coreColor, midColor, coolColor } = this.effectsConfigState.charcoal;
    return semanticToCharcoalParams({ intensity, spread, glow }, { coreColor, midColor, coolColor });
  }

  /** Check whether a given overlay effect is currently enabled. */
  isEffectEnabled(effect: OverlayEffectEntry["effect"]): boolean {
    return this.prevEffectEnabled.get(effect) ?? false;
  }

  // ── Generic Overlay Sync ────────────────────────────────────────────

  /**
   * Generic init/destroy lifecycle for a single registry-driven overlay effect.
   */
  private syncOverlay(entry: OverlayEffectEntry): void {
    const enabled = this.prevEffectEnabled.get(entry.effect) ?? false;

    if (enabled) {
      const current = this.getOverlayRenderer(entry.rendererField);
      if (!current?.isInitialized()) {
        if (!this.containerElement) return;
        const renderer: OverlayRenderer = new entry.RendererClass();
        const success = renderer.initialize(
          this.containerElement,
          this.canvasSize,
          this.canvasSize,
        );
        if (success) {
          this.setOverlayRenderer(entry.rendererField, renderer);
          this.renderLoopService?.updateConfig({
            [entry.configKey]: renderer,
          } as Partial<RenderLoopConfig>);
          entry.onInit?.(this, renderer);
        } else {
          this.setOverlayRenderer(entry.rendererField, null);
        }
      }
    } else {
      const current = this.getOverlayRenderer(entry.rendererField);
      if (current?.isInitialized()) {
        current.dispose();
        this.setOverlayRenderer(entry.rendererField, null);
      }
      this.renderLoopService?.updateConfig({
        [entry.configKey]: null,
      } as Partial<RenderLoopConfig>);
      entry.onDisable?.(this);
    }

    if (entry.triggerRender !== false) {
      this.triggerRender();
    }
  }

  /**
   * Sync a single effect overlay by name. Finds the registry entry and delegates.
   */
  syncEffectOverlay(effect: OverlayEffectEntry["effect"]): void {
    const entry = OVERLAY_REGISTRY.find(e => e.effect === effect);
    if (entry) this.syncOverlay(entry);
  }

  /**
   * Sync all 14 registry-driven overlay effects.
   */
  syncAllOverlays(): void {
    for (const entry of OVERLAY_REGISTRY) {
      this.syncOverlay(entry);
    }
  }

  /**
   * Initialize or destroy the LED overlay based on config.enabled.
   * Creates the WebGL canvas lazily on first enable, removes on disable.
   *
   * IMPORTANT: LED WebGL initialization (shader compilation, framebuffer creation)
   * is deferred via requestAnimationFrame to prevent blocking the main thread
   * during Svelte effect processing. On Windows/ANGLE, synchronous shader
   * compilation can hang the page for seconds.
   */
  syncLedOverlay(): void {
    if (this.ledConfig.enabled && !this.ledRenderer?.isInitialized()) {
      if (!this.containerElement || this.ledInitPending) return;
      // Defer WebGL initialization to avoid blocking the reactive effect chain.
      // Without this, shader compilation on Windows/ANGLE can freeze the entire page.
      this.ledInitPending = true;
      requestAnimationFrame(() => {
        this.ledInitPending = false;
        // Re-check: config or container may have changed while deferred
        if (!this.ledConfig.enabled || !this.containerElement) return;
        if (this.ledRenderer?.isInitialized()) return;
        try {
          this.ledRenderer = new WebGLLedRenderer();
          const success = this.ledRenderer.initialize(
            this.containerElement,
            this.canvasSize,
            this.canvasSize
          );
          if (success) {
            this.renderLoopService?.updateConfig({
              ledRenderer: this.ledRenderer,
            });
            // Trigger a render now that the renderer is ready
            this.triggerRender();
          } else {
            console.warn("[AnimationEngine] LED WebGL initialization failed");
            this.ledRenderer = null;
          }
        } catch (err) {
          console.error("[AnimationEngine] LED overlay init error:", err);
          this.ledRenderer = null;
        }
      });
    } else if (!this.ledConfig.enabled && this.ledRenderer) {
      this.ledRenderer.dispose();
      this.ledRenderer = null;
      this.renderLoopService?.updateConfig({ ledRenderer: null });
      this.ledTipTracker?.reset();
    }
  }

  // ── Config setters / getters ────────────────────────────────────────

  /**
   * Set fire overlay configuration. Called by visibility state changes.
   */
  setFireConfig(config: Partial<FireOverlayConfig>): void {
    Object.assign(this.fireConfig, config);
    // Forward quality setting to renderer if present
    if (config.quality !== undefined && this.fireRenderer) {
      this.fireRenderer.setQuality(config.quality);
    }
    this.syncEffectOverlay("fire");

    // Trigger a render to start/stop fire loop
    this.triggerRender();
  }

  /**
   * Get current fire overlay configuration.
   */
  getFireConfig(): FireOverlayConfig {
    return { ...this.fireConfig };
  }

  /**
   * Set LED overlay configuration. Called by visibility state changes.
   */
  setLedConfig(config: Partial<LedOverlayConfig>): void {
    Object.assign(this.ledConfig, config);
    this.syncLedOverlay();

    // Trigger a render to start/stop LED loop
    this.triggerRender();
  }

  /**
   * Get current LED overlay configuration.
   */
  getLedConfig(): LedOverlayConfig {
    return { ...this.ledConfig };
  }

  /**
   * Set per-cell tip effect map. When provided, this map takes priority
   * over the global visibility manager's map in getFrameParams().
   * Also syncs renderer lifecycle flags so per-cell assignments
   * correctly initialize/destroy overlay renderers.
   */
  setCellTipEffectMap(map: TipEffectMap | undefined): void {
    this.cellTipEffectMap = map;
    this.syncEffectFlagsFromEffectiveMap();
  }

  /**
   * Set per-cell tip effort map. When provided, this map takes priority
   * over the global visibility manager's map in getFrameParams().
   */
  setCellTipEffortMap(map: TipEffortMap | undefined): void {
    this.cellTipEffortMap = map;
  }

  // ── Effective-map queries ────────────────────────────────────────────

  /**
   * Check whether any tip in the effective map (cell-level override first,
   * then global VM map) is assigned the given effect.
   */
  hasEffectInEffectiveMap(effect: EffectType): boolean {
    const effectiveMap = this.cellTipEffectMap ??
      this.effectsConfigState?.tipEffectMap ?? {};
    return Object.values(effectiveMap).some(a => a.effect === effect);
  }

  /**
   * Re-derive all prevHasXTips flags (and ledConfig.enabled) from the
   * effective tipEffectMap. Called when the cell-level map changes so that
   * per-cell assignments correctly spin up / tear down overlay renderers.
   */
  syncEffectFlagsFromEffectiveMap(): void {
    for (const entry of OVERLAY_REGISTRY) {
      const has = this.hasEffectInEffectiveMap(entry.effect);
      const prev = this.prevEffectEnabled.get(entry.effect) ?? false;
      if (has !== prev) {
        this.prevEffectEnabled.set(entry.effect, has);
        this.syncOverlay(entry);
      }
    }

    const hasLed = this.hasEffectInEffectiveMap("led");
    if (hasLed !== this.ledConfig.enabled) {
      this.setLedConfig({ enabled: hasLed });
    }
  }

  // ── Layer Ordering ──────────────────────────────────────────────────

  /**
   * Push each effect's behind/front layer override to its overlay canvas.
   * Safe to call any time; renderers that aren't initialized yet are skipped.
   */
  syncEffectLayers(): void {
    if (!this.effectsConfigState) return;
    const state = this.effectsConfigState;
    const apply = (id: string, renderer: { setCanvasZIndex?: (z: number) => void } | null) => {
      if (!renderer?.setCanvasZIndex) return;
      renderer.setCanvasZIndex(resolveEffectZ(id, state.getEffectLayer(id)));
    };
    apply("trails", this.trailOverlay);
    apply("led", this.ledRenderer);
    for (const entry of OVERLAY_REGISTRY) {
      apply(entry.effect, this.getOverlayRenderer(entry.rendererField));
    }
  }

  // ── Trail Overlay Factory ───────────────────────────────────────────

  /** Runtime A/B toggle: set `window.__TKA_TRAIL_GPU = false` before
   *  a sequence starts to use the legacy Canvas2D overlay instead of
   *  the WebGL2 backend. Default is WebGL2. */
  createTrailOverlay(): ITrailOverlayCanvas {
    const flag =
      typeof window !== "undefined"
        ? (window as { __TKA_TRAIL_GPU?: boolean }).__TKA_TRAIL_GPU
        : undefined;
    if (flag === false) {
       
      console.info("[TrailOverlay] using legacy Canvas2D (window.__TKA_TRAIL_GPU = false)");
      return new TrailOverlayCanvas();
    }
    return new TrailOverlayWebGL2();
  }

  // ── Resize ──────────────────────────────────────────────────────────

  /** Resize all effect overlay canvases to the new canvas size. */
  resizeAll(newSize: number): void {
    this.canvasSize = newSize;
    // Resize all registry-driven renderers
    for (const entry of OVERLAY_REGISTRY) {
      this.getOverlayRenderer(entry.rendererField)?.resize?.(newSize, newSize);
    }
    // LED + trail handled separately
    this.ledRenderer?.resize(newSize, newSize);
    this.trailOverlay?.resize(newSize, newSize);
    // Reset fire/LED tip trackers so positions recalculate at the new canvas size.
    // Without this, after HMR the tracker uses stale positions from the old size.
    this.fireTipTracker?.reset();
    this.ledTipTracker?.reset();
  }

  // ── Wire post-init overlays ─────────────────────────────────────────

  /**
   * Re-wire overlay renderers that may have been created during the async
   * initializeCanvas gap. Called after renderLoopService is ready.
   */
  wirePostInitOverlays(): void {
    for (const entry of OVERLAY_REGISTRY) {
      const renderer = this.getOverlayRenderer(entry.rendererField);
      if (renderer?.isInitialized() && this.renderLoopService) {
        this.renderLoopService.updateConfig({
          [entry.configKey]: renderer,
        } as Partial<RenderLoopConfig>);
      }
    }
    if (this.ledRenderer?.isInitialized() && this.renderLoopService) {
      this.renderLoopService.updateConfig({
        ledRenderer: this.ledRenderer,
      });
    }
  }

  /**
   * Ensure overlays that should be enabled are actually created.
   * Called at end of initialize() in case $effects haven't triggered yet.
   */
  ensureEnabledOverlays(): void {
    for (const entry of OVERLAY_REGISTRY) {
      const enabled = this.prevEffectEnabled.get(entry.effect) ?? false;
      if (enabled && !this.getOverlayRenderer(entry.rendererField)?.isInitialized()) {
        this.syncOverlay(entry);
      }
    }
    if (this.ledConfig.enabled && !this.ledRenderer?.isInitialized()) {
      this.syncLedOverlay();
    }
  }

  /**
   * Initialize LED state from visibility manager values.
   */
  initLedConfigFromVM(vm: AnimationVisibilityStateManager): void {
    this.ledConfig.enabled = vm.hasEffect("led");
    this.ledConfig.patternId = vm.getLedPatternId();
    this.ledConfig.primaryColor = vm.getLedPrimaryColor();
    this.ledConfig.secondaryColor = vm.getLedSecondaryColor();
    this.ledConfig.colorMode = vm.getLedColorMode();
  }

  /**
   * Sync LED config from visibility manager. Returns a partial diff for
   * batched setLedConfig() call.
   */
  diffLedConfigFromVM(vm: AnimationVisibilityStateManager): Partial<LedOverlayConfig> {
    const ledEnabled = this.hasEffectInEffectiveMap("led");
    const ledPatternId = vm.getLedPatternId();
    const ledColor = vm.getLedPrimaryColor();
    const ledSecondaryColor = vm.getLedSecondaryColor();
    const ledBrightness = ledBrightnessToFloat(vm.getLedBrightness());
    const ledColorMode = vm.getLedColorMode();

    const ledDiff: Partial<LedOverlayConfig> = {};
    if (ledEnabled !== this.ledConfig.enabled) ledDiff.enabled = ledEnabled;
    if (ledPatternId !== this.ledConfig.patternId) ledDiff.patternId = ledPatternId;
    if (ledColor !== this.ledConfig.primaryColor) ledDiff.primaryColor = ledColor;
    if (ledSecondaryColor !== this.ledConfig.secondaryColor) ledDiff.secondaryColor = ledSecondaryColor;
    if (ledBrightness !== this.ledConfig.brightness) ledDiff.brightness = ledBrightness;
    if (ledColorMode !== this.ledConfig.colorMode) ledDiff.colorMode = ledColorMode;

    return ledDiff;
  }

  // ── Dispose ─────────────────────────────────────────────────────────

  dispose(): void {
    // Dispose all registry-driven renderers
    for (const entry of OVERLAY_REGISTRY) {
      this.getOverlayRenderer(entry.rendererField)?.dispose();
      this.setOverlayRenderer(entry.rendererField, null);
    }
    this.fireTipTracker = null;

    // Dispose LED overlay (also prevent any pending deferred init from running)
    this.ledConfig.enabled = false;
    this.ledRenderer?.dispose();
    this.ledRenderer = null;
    this.ledTipTracker = null;

    // Dispose trail overlay
    this.trailOverlay?.dispose();
    this.trailOverlay = null;
  }

  // ── Private helpers ─────────────────────────────────────────────────

  private triggerRender(): void {
    if (this.renderLoopService && this.getFrameParams) {
      this.renderLoopService.triggerRender(this.getFrameParams);
    }
  }
}
