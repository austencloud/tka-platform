/**
 * EffectRendererManager
 *
 * Owns all 16 effect overlay renderers (fire, charcoal, LED, trails, zap, sparkles,
 * echo, bloom, water, bubbles, petals, smoke, ink, frost, silk, pulse).
 * Handles initialize/destroy lifecycle, config sync, and layer ordering.
 *
 * Extracted from AnimationEngine to reduce its line count.
 * This is a plain TypeScript class - no Svelte reactivity needed.
 *
 * P2.3: Named renderer fields replaced by Map<EffectType, EffectRendererLike>.
 * Access via getRenderer(id). Typed helpers (get fireRenderer, etc.) delegate
 * to the Map with a cast for callers that need effect-specific methods.
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
// WebGLLedRenderer imported as value — syncLedOverlay uses deferred requestAnimationFrame init.
// LED is special-cased: instantiation deferred, then stored in renderers Map via `set("led", ...)`.
import { WebGLLedRenderer } from "./led/WebGLLedRenderer";
import type { CharcoalSparkRenderer } from "./charcoal/CharcoalSparkRenderer";
import type { WebGLFireRenderer } from "./fire/WebGLFireRenderer";
import type { WebGLLedRenderer as WebGLLedRendererType } from "./led/WebGLLedRenderer";

/** Callback to obtain current frame params (used to trigger re-renders). */
export type FrameParamsProvider = () => RenderFrameParams;

/**
 * Overlay effects driven by EFFECT_PLUGINS (kind canvas2d | webgl).
 * Excludes led (unique deferred lifecycle) and trails (handled separately).
 */
type OverlayEffectId = Exclude<EffectType, "none" | "led" | "trails">;

/** The 14 plugins that use the generic overlay lifecycle (canvas2d + webgl, no led/trails). */
const OVERLAY_PLUGINS = EFFECT_PLUGINS.filter(
  (p) => p.kind === "canvas2d" || p.kind === "webgl"
) as readonly (typeof EFFECT_PLUGINS[number] & { id: OverlayEffectId })[];

export class EffectRendererManager {
  // ── Registry-backed renderer Map (P2.3) ─────────────────────────────
  // All renderer instances live here. Access via getRenderer(id).
  private renderers = new Map<EffectType, EffectRendererLike>();

  // ── Non-registry fields (trackers, configs, maps) ────────────────────
  fireTipTracker: FireTipTracker | null = null;
  ledTipTracker: LedTipTracker | null = null;

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

  /** Whether the given overlay effect was enabled last frame. */
  wasEnabled(id: OverlayEffectId): boolean {
    return this.prevEffectEnabled.get(id) ?? false;
  }

  /** Set the was-enabled flag for the given overlay effect. */
  setWasEnabled(id: OverlayEffectId, value: boolean): void {
    this.prevEffectEnabled.set(id, value);
  }

  // ── Typed renderer accessors (callers need effect-specific methods) ──

  /** Returns the fire renderer, cast to its concrete type, or null. */
  get fireRenderer(): WebGLFireRenderer | null {
    return (this.renderers.get("fire") ?? null) as WebGLFireRenderer | null;
  }

  /** Returns the charcoal renderer, cast to its concrete type, or null. */
  get charcoalRenderer(): CharcoalSparkRenderer | null {
    return (this.renderers.get("charcoal") ?? null) as CharcoalSparkRenderer | null;
  }

  /** Returns the LED renderer, cast to its concrete type, or null. */
  get ledRenderer(): WebGLLedRendererType | null {
    return (this.renderers.get("led") ?? null) as WebGLLedRendererType | null;
  }

  /** Returns the trail overlay, cast to ITrailOverlayCanvas, or null. */
  get trailOverlay(): ITrailOverlayCanvas | null {
    return (this.renderers.get("trails") ?? null) as unknown as ITrailOverlayCanvas | null;
  }

  /** Set the trail overlay into the registry Map. Called externally by CanvasLifecycleManager. */
  set trailOverlay(value: ITrailOverlayCanvas | null) {
    if (value == null) {
      this.renderers.delete("trails");
    } else {
      this.renderers.set("trails", value as unknown as EffectRendererLike);
    }
  }

  // ── Dependencies (injected) ─────────────────────────────────────────
  private containerElement: HTMLDivElement | null = null;
  private canvasSize: number = 0;
  private renderLoopService: IAnimationRenderLoop | null = null;
  private getFrameParams: FrameParamsProvider | null = null;
  private getVM: (() => AnimationVisibilityStateManager) | null = null;
  effectsConfigState: EffectsConfigState | null = null;

  // ── Public registry accessor ────────────────────────────────────────

  /** Get a renderer by effect id. Returns null if not initialized. */
  getRenderer(id: EffectType): EffectRendererLike | null {
    return this.renderers.get(id) ?? null;
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
   * Driven by EFFECT_PLUGINS (canvas2d + webgl kinds) via the renderers Map.
   */
  private syncOverlay(plugin: typeof OVERLAY_PLUGINS[number]): void {
    const id = plugin.id as OverlayEffectId;
    const enabled = this.prevEffectEnabled.get(id) ?? false;

    if (enabled) {
      const current = this.renderers.get(id);
      if (!current?.isInitialized()) {
        if (!this.containerElement) return;
        const renderer = plugin.createRenderer();
        const success = renderer.initialize(
          this.containerElement,
          this.canvasSize,
          this.canvasSize,
        );
        if (success) {
          this.renderers.set(id, renderer);
          this.renderLoopService?.updateConfig({
            renderers: { [id]: renderer },
          } as Partial<RenderLoopConfig>);
          plugin.onInit?.(this, renderer);
        } else {
          this.renderers.delete(id);
        }
      }
    } else {
      const current = this.renderers.get(id);
      if (current?.isInitialized()) {
        current.dispose();
        this.renderers.delete(id);
      }
      this.renderLoopService?.updateConfig({
        renderers: { [id]: null },
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
   *
   * LED special-case: deferred lifecycle resists full plugin.createRenderer() integration
   * at the initialization site. The renderer is still stored in the Map once ready.
   */
  syncLedOverlay(): void {
    const currentLed = this.renderers.get("led");
    if (this.ledConfig.enabled && !currentLed?.isInitialized()) {
      if (!this.containerElement || this.ledInitPending) return;
      // Defer WebGL initialization to avoid blocking the reactive effect chain.
      // Without this, shader compilation on Windows/ANGLE can freeze the entire page.
      this.ledInitPending = true;
      requestAnimationFrame(() => {
        this.ledInitPending = false;
        // Re-check: config or container may have changed while deferred
        if (!this.ledConfig.enabled || !this.containerElement) return;
        if (this.renderers.get("led")?.isInitialized()) return;
        try {
          const ledRenderer = new WebGLLedRenderer();
          const success = ledRenderer.initialize(
            this.containerElement,
            this.canvasSize,
            this.canvasSize
          );
          if (success) {
            this.renderers.set("led", ledRenderer);
            this.renderLoopService?.updateConfig({
              renderers: { led: ledRenderer },
            });
            // Trigger a render now that the renderer is ready
            this.triggerRender();
          } else {
            console.warn("[AnimationEngine] LED WebGL initialization failed");
            this.renderers.delete("led");
          }
        } catch (err) {
          console.error("[AnimationEngine] LED overlay init error:", err);
          this.renderers.delete("led");
        }
      });
    } else if (!this.ledConfig.enabled && this.renderers.has("led")) {
      const led = this.renderers.get("led");
      led?.dispose();
      this.renderers.delete("led");
      this.renderLoopService?.updateConfig({ renderers: { led: null } });
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
   * Re-derive all prevEffectEnabled flags (and ledConfig.enabled) from the
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
      apply(plugin.id, this.renderers.get(plugin.id as OverlayEffectId) ?? null);
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
    // Resize all registry-driven renderers (canvas2d + webgl overlays)
    for (const plugin of OVERLAY_PLUGINS) {
      this.renderers.get(plugin.id as OverlayEffectId)?.resize?.(newSize, newSize);
    }
    // LED + trail handled separately
    this.renderers.get("led")?.resize?.(newSize, newSize);
    this.renderers.get("trails")?.resize?.(newSize, newSize);
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
    // Build a single renderers partial and send one updateConfig call.
    const renderersUpdate: Partial<Record<EffectType, EffectRendererLike>> = {};
    for (const plugin of OVERLAY_PLUGINS) {
      const renderer = this.renderers.get(plugin.id as OverlayEffectId);
      if (renderer?.isInitialized()) {
        renderersUpdate[plugin.id as OverlayEffectId] = renderer;
      }
    }
    const led = this.renderers.get("led");
    if (led?.isInitialized()) {
      renderersUpdate["led"] = led;
    }
    if (Object.keys(renderersUpdate).length > 0 && this.renderLoopService) {
      this.renderLoopService.updateConfig({ renderers: renderersUpdate });
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
      if (enabled && !this.renderers.get(id)?.isInitialized()) {
        this.syncOverlay(plugin);
      }
    }
    if (this.ledConfig.enabled && !this.renderers.get("led")?.isInitialized()) {
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
    // Dispose all registry-driven renderers (canvas2d + webgl overlays)
    for (const plugin of OVERLAY_PLUGINS) {
      const renderer = this.renderers.get(plugin.id as OverlayEffectId);
      renderer?.dispose();
      this.renderers.delete(plugin.id as OverlayEffectId);
    }
    this.fireTipTracker = null;

    // Dispose LED overlay (also prevent any pending deferred init from running)
    this.ledConfig.enabled = false;
    const led = this.renderers.get("led");
    led?.dispose();
    this.renderers.delete("led");
    this.ledTipTracker = null;

    // Dispose trail overlay
    const trail = this.renderers.get("trails");
    trail?.dispose();
    this.renderers.delete("trails");
  }

  // ── Private helpers ─────────────────────────────────────────────────

  private triggerRender(): void {
    if (this.renderLoopService && this.getFrameParams) {
      this.renderLoopService.triggerRender(this.getFrameParams);
    }
  }
}
