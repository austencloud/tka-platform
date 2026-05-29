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
import type { EffectRendererLike } from "../effects/EffectRenderer";
import { EFFECT_PLUGINS, EFFECT_PLUGIN_BY_ID } from "../effects/registry";

import type { CharcoalSparkRenderer } from "./charcoal/CharcoalSparkRenderer";
import type { WebGLFireRenderer } from "./fire/WebGLFireRenderer";
// WebGLLedRenderer imported as value — syncLedOverlay uses deferred init (requestAnimationFrame)
// that still directly instantiates it. Task 8 (Map-backing) will switch to plugin.createRenderer().
import { WebGLLedRenderer } from "./led/WebGLLedRenderer";
import type { ZapOverlayRenderer } from "./ZapOverlayRenderer";
import type { SparklesOverlayRenderer } from "./SparklesOverlayRenderer";
import type { EchoOverlayRenderer } from "./EchoOverlayRenderer";
import type { BloomOverlayRenderer } from "./BloomOverlayRenderer";
import type { WaterOverlayRenderer } from "./WaterOverlayRenderer";
import type { BubblesOverlayRenderer } from "./BubblesOverlayRenderer";
import type { PetalsOverlayRenderer } from "./PetalsOverlayRenderer";
import type { SmokeOverlayRenderer } from "./SmokeOverlayRenderer";
import type { InkOverlayRenderer } from "./InkOverlayRenderer";
import type { FrostOverlayRenderer } from "./FrostOverlayRenderer";
import type { SilkOverlayRenderer } from "./SilkOverlayRenderer";
import type { PulseOverlayRenderer } from "./PulseOverlayRenderer";

/** Callback to obtain current frame params (used to trigger re-renders). */
export type FrameParamsProvider = () => RenderFrameParams;

/**
 * Overlay effects driven by EFFECT_PLUGINS (kind canvas2d | webgl).
 * Excludes led (unique deferred lifecycle) and trails (handled separately).
 */
type OverlayEffectId = Exclude<EffectType, "none" | "led" | "trails">;

/**
 * P2.2 shim: maps plugin id → named renderer field on the class.
 * Task 8 (P2.3) will dissolve this entirely by replacing the 16 named fields
 * with a Map<EffectType, EffectRendererLike>.
 */
const RENDERER_FIELD: Record<OverlayEffectId, keyof EffectRendererManager & string> = {
  fire: "fireRenderer",
  charcoal: "charcoalRenderer",
  zap: "zapRenderer",
  sparkles: "sparklesRenderer",
  echo: "echoRenderer",
  bloom: "bloomRenderer",
  water: "waterRenderer",
  bubbles: "bubblesRenderer",
  petals: "petalsRenderer",
  smoke: "smokeRenderer",
  ink: "inkRenderer",
  frost: "frostRenderer",
  silk: "silkRenderer",
  pulse: "pulseRenderer",
};

/** The 14 plugins that use the generic overlay lifecycle (canvas2d + webgl, no led/trails). */
const OVERLAY_PLUGINS = EFFECT_PLUGINS.filter(
  (p) => p.kind === "canvas2d" || p.kind === "webgl"
) as readonly (typeof EFFECT_PLUGINS[number] & { id: OverlayEffectId })[];

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
  private prevEffectEnabled: Map<OverlayEffectId, boolean> = new Map(
    OVERLAY_PLUGINS.map(p => [p.id as OverlayEffectId, false])
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
  // P2.2 shim: accesses named fields by string key until Task 8 replaces them with a Map.
  private getOverlayRenderer(field: string): EffectRendererLike | null {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this as any)[field] as EffectRendererLike | null;
  }
  private setOverlayRenderer(field: string, value: EffectRendererLike | null): void {
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
  isEffectEnabled(effect: OverlayEffectId): boolean {
    return this.prevEffectEnabled.get(effect) ?? false;
  }

  // ── Generic Overlay Sync ────────────────────────────────────────────

  /**
   * Generic init/destroy lifecycle for a single registry-driven overlay effect.
   * Driven by EFFECT_PLUGINS (canvas2d + webgl kinds) via the P2.2 RENDERER_FIELD shim.
   */
  private syncOverlay(plugin: typeof OVERLAY_PLUGINS[number]): void {
    const id = plugin.id as OverlayEffectId;
    const rendererField = RENDERER_FIELD[id];
    const enabled = this.prevEffectEnabled.get(id) ?? false;

    if (enabled) {
      const current = this.getOverlayRenderer(rendererField);
      if (!current?.isInitialized()) {
        if (!this.containerElement) return;
        const renderer = plugin.createRenderer();
        const success = renderer.initialize(
          this.containerElement,
          this.canvasSize,
          this.canvasSize,
        );
        if (success) {
          this.setOverlayRenderer(rendererField, renderer);
          this.renderLoopService?.updateConfig({
            [plugin.configKey]: renderer,
          } as Partial<RenderLoopConfig>);
          plugin.onInit?.(this, renderer);
        } else {
          this.setOverlayRenderer(rendererField, null);
        }
      }
    } else {
      const current = this.getOverlayRenderer(rendererField);
      if (current?.isInitialized()) {
        current.dispose();
        this.setOverlayRenderer(rendererField, null);
      }
      this.renderLoopService?.updateConfig({
        [plugin.configKey]: null,
      } as Partial<RenderLoopConfig>);
      plugin.onDisable?.(this);
    }

    if (plugin.triggerRender !== false) {
      this.triggerRender();
    }
  }

  /**
   * Sync a single effect overlay by name. Finds the plugin and delegates.
   */
  syncEffectOverlay(effect: OverlayEffectId): void {
    const plugin = EFFECT_PLUGIN_BY_ID[effect] as typeof OVERLAY_PLUGINS[number] | undefined;
    if (plugin && (plugin.kind === "canvas2d" || plugin.kind === "webgl")) {
      this.syncOverlay(plugin);
    }
  }

  /**
   * Sync all 14 registry-driven overlay effects.
   */
  syncAllOverlays(): void {
    for (const plugin of OVERLAY_PLUGINS) {
      this.syncOverlay(plugin);
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
    for (const plugin of OVERLAY_PLUGINS) {
      const id = plugin.id as OverlayEffectId;
      const has = this.hasEffectInEffectiveMap(id);
      const prev = this.prevEffectEnabled.get(id) ?? false;
      if (has !== prev) {
        this.prevEffectEnabled.set(id, has);
        this.syncOverlay(plugin);
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
    for (const plugin of OVERLAY_PLUGINS) {
      apply(plugin.id, this.getOverlayRenderer(RENDERER_FIELD[plugin.id as OverlayEffectId]));
    }
  }

  // ── Trail Overlay Factory ───────────────────────────────────────────

  /** Runtime A/B toggle: set `window.__TKA_TRAIL_GPU = false` before
   *  a sequence starts to use the legacy Canvas2D overlay instead of
   *  the WebGL2 backend. Default is WebGL2.
   *  Thin wrapper — factory logic now lives in trailsEffectPlugin.createRenderer(). */
  createTrailOverlay(): ITrailOverlayCanvas {
    return EFFECT_PLUGIN_BY_ID.trails.createRenderer() as unknown as ITrailOverlayCanvas;
  }

  // ── Resize ──────────────────────────────────────────────────────────

  /** Resize all effect overlay canvases to the new canvas size. */
  resizeAll(newSize: number): void {
    this.canvasSize = newSize;
    // Resize all registry-driven renderers
    for (const plugin of OVERLAY_PLUGINS) {
      this.getOverlayRenderer(RENDERER_FIELD[plugin.id as OverlayEffectId])?.resize?.(newSize, newSize);
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
    for (const plugin of OVERLAY_PLUGINS) {
      const renderer = this.getOverlayRenderer(RENDERER_FIELD[plugin.id as OverlayEffectId]);
      if (renderer?.isInitialized() && this.renderLoopService) {
        this.renderLoopService.updateConfig({
          [plugin.configKey]: renderer,
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
    for (const plugin of OVERLAY_PLUGINS) {
      const id = plugin.id as OverlayEffectId;
      const enabled = this.prevEffectEnabled.get(id) ?? false;
      if (enabled && !this.getOverlayRenderer(RENDERER_FIELD[id])?.isInitialized()) {
        this.syncOverlay(plugin);
      }
    }
    if (this.ledConfig.enabled && !this.ledRenderer?.isInitialized()) {
      this.syncLedOverlay();
    }
  }

  /**
   * Initialize LED state from EffectsConfigState values.
   */
  initLedConfigFromEffectsState(ecs: EffectsConfigState | null): void {
    const tipMap = ecs?.tipEffectMap ?? {};
    this.ledConfig.enabled = Object.values(tipMap).some(a => a.effect === "led");
    this.ledConfig.patternId = ecs?.led.patternId ?? "solid";
    this.ledConfig.primaryColor = ecs?.led.primaryColor ?? "#00ff88";
    this.ledConfig.secondaryColor = ecs?.led.secondaryColor ?? "#ffffff";
    this.ledConfig.colorMode = ecs?.led.colorMode ?? "unified";
  }

  /**
   * Sync LED config from EffectsConfigState. Returns a partial diff for
   * batched setLedConfig() call.
   */
  diffLedConfigFromEffectsState(ecs: EffectsConfigState | null): Partial<LedOverlayConfig> {
    const ledEnabled = this.hasEffectInEffectiveMap("led");
    const ledPatternId = ecs?.led.patternId ?? "solid";
    const ledColor = ecs?.led.primaryColor ?? "#00ff88";
    const ledSecondaryColor = ecs?.led.secondaryColor ?? "#ffffff";
    const ledBrightness = ledBrightnessToFloat(ecs?.led.brightness ?? 5);
    const ledColorMode = ecs?.led.colorMode ?? "unified";

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
    for (const plugin of OVERLAY_PLUGINS) {
      const field = RENDERER_FIELD[plugin.id as OverlayEffectId];
      this.getOverlayRenderer(field)?.dispose();
      this.setOverlayRenderer(field, null);
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
