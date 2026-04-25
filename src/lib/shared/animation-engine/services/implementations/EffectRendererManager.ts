/**
 * EffectRendererManager
 *
 * Owns all 14 effect overlay renderers (fire, charcoal, LED, zap, sparkles,
 * echo, bloom, water, bubbles, petals, smoke, ink, frost, silk).
 * Handles initialize/destroy lifecycle, config sync, and layer ordering.
 *
 * Extracted from AnimationEngine to reduce its line count.
 * This is a plain TypeScript class — no Svelte reactivity needed.
 */

import type { IFireOverlayRenderer } from "../contracts/IFireOverlayRenderer";
import type { ICharcoalRenderer } from "../contracts/ICharcoalRenderer";
import type { IFireTipTracker } from "../contracts/IFireTipTracker";
import type { ILedOverlayRenderer } from "../contracts/ILedOverlayRenderer";
import type { ILedTipTracker } from "../contracts/ILedTipTracker";
import type { ITrailOverlayCanvas } from "../contracts/ITrailOverlayCanvas";
import type { IZapOverlayRenderer } from "../contracts/IZapOverlayRenderer";
import type { ISparklesOverlayRenderer } from "../contracts/ISparklesOverlayRenderer";
import type { IEchoOverlayRenderer } from "../contracts/IEchoOverlayRenderer";
import type { IBloomOverlayRenderer } from "../contracts/IBloomOverlayRenderer";
import type { IWaterOverlayRenderer } from "../contracts/IWaterOverlayRenderer";
import type { IBubblesOverlayRenderer } from "../contracts/IBubblesOverlayRenderer";
import type { IPetalsOverlayRenderer } from "../contracts/IPetalsOverlayRenderer";
import type { ISmokeOverlayRenderer } from "../contracts/ISmokeOverlayRenderer";
import type { IInkOverlayRenderer } from "../contracts/IInkOverlayRenderer";
import type { IFrostOverlayRenderer } from "../contracts/IFrostOverlayRenderer";
import type { ISilkOverlayRenderer } from "../contracts/ISilkOverlayRenderer";
import type { IAnimationRenderLoop } from "../contracts/IAnimationRenderLoop";
import type { TipEffectMap, TipEffortMap } from "../../domain/types/TipEffectTypes";
import type { FireOverlayConfig } from "../../domain/types/FireTypes";
import { DEFAULT_FIRE_CONFIG } from "../../domain/types/FireTypes";
import type { LedOverlayConfig } from "../../domain/types/LedTypes";
import { DEFAULT_LED_CONFIG, ledBrightnessToFloat } from "../../domain/types/LedTypes";
import { resolveEffectZ } from "../effect-layer";
import type { AnimationVisibilityStateManager } from "../../state/animation-visibility-state.svelte";
import type { RenderFrameParams } from "../contracts/IAnimationRenderLoop";

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
import { TrailOverlayWebGL2 } from "./TrailOverlayWebGL2";
import { TrailOverlayCanvas } from "./TrailOverlayCanvas";

/** Callback to obtain current frame params (used to trigger re-renders). */
export type FrameParamsProvider = () => RenderFrameParams;

export class EffectRendererManager {
  // ── Renderer instances ──────────────────────────────────────────────
  fireRenderer: IFireOverlayRenderer | null = null;
  charcoalRenderer: ICharcoalRenderer | null = null;
  fireTipTracker: IFireTipTracker | null = null;
  ledRenderer: ILedOverlayRenderer | null = null;
  ledTipTracker: ILedTipTracker | null = null;
  trailOverlay: ITrailOverlayCanvas | null = null;
  zapRenderer: IZapOverlayRenderer | null = null;
  sparklesRenderer: ISparklesOverlayRenderer | null = null;
  echoRenderer: IEchoOverlayRenderer | null = null;
  bloomRenderer: IBloomOverlayRenderer | null = null;
  waterRenderer: IWaterOverlayRenderer | null = null;
  bubblesRenderer: IBubblesOverlayRenderer | null = null;
  petalsRenderer: IPetalsOverlayRenderer | null = null;
  smokeRenderer: ISmokeOverlayRenderer | null = null;
  inkRenderer: IInkOverlayRenderer | null = null;
  frostRenderer: IFrostOverlayRenderer | null = null;
  silkRenderer: ISilkOverlayRenderer | null = null;

  // ── Configs ─────────────────────────────────────────────────────────
  fireConfig: FireOverlayConfig = { ...DEFAULT_FIRE_CONFIG };
  ledConfig: LedOverlayConfig = { ...DEFAULT_LED_CONFIG };
  private ledInitPending = false;

  // ── Per-cell maps ───────────────────────────────────────────────────
  cellTipEffectMap: TipEffectMap | undefined = undefined;
  cellTipEffortMap: TipEffortMap | undefined = undefined;

  // ── Previous-frame flags for change detection ───────────────────────
  prevHasFireTips = false;
  prevHasCharcoalTips = false;
  prevHasZapTips = false;
  prevHasSparklesTips = false;
  prevHasEchoTips = false;
  prevHasBloomTips = false;
  prevHasWaterTips = false;
  prevHasBubblesTips = false;
  prevHasPetalsTips = false;
  prevHasSmokeTips = false;
  prevHasInkTips = false;
  prevHasFrostTips = false;
  prevHasSilkTips = false;

  // ── Dependencies (injected) ─────────────────────────────────────────
  private containerElement: HTMLDivElement | null = null;
  private canvasSize: number = 0;
  private renderLoopService: IAnimationRenderLoop | null = null;
  private getFrameParams: FrameParamsProvider | null = null;
  private getVM: (() => AnimationVisibilityStateManager) | null = null;

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

  // ── Sync Overlay Methods ────────────────────────────────────────────

  /**
   * Initialize or destroy the fire overlay based on prevHasFireTips.
   * Fire and charcoal are independent effects with independent renderers.
   */
  syncFireOverlay(): void {
    const enabled = this.prevHasFireTips;

    if (enabled) {
      if (!this.fireRenderer?.isInitialized()) {
        if (!this.containerElement) return;
        this.fireRenderer = new WebGLFireRenderer();
        const success = this.fireRenderer.initialize(
          this.containerElement,
          this.canvasSize,
          this.canvasSize
        );
        if (success) {
          this.renderLoopService?.updateConfig({
            fireRenderer: this.fireRenderer,
          });
        } else {
          this.fireRenderer = null;
        }
      }
    } else {
      if (this.fireRenderer?.isInitialized()) {
        this.fireRenderer.dispose();
        this.fireRenderer = null;
      }
      this.renderLoopService?.updateConfig({ fireRenderer: null });
      if (!this.prevHasCharcoalTips) {
        this.fireTipTracker?.reset();
      }
    }
  }

  /**
   * Initialize or destroy the charcoal overlay based on prevHasCharcoalTips.
   * Charcoal is an independent effect with its own particle renderer.
   */
  syncCharcoalOverlay(): void {
    const enabled = this.prevHasCharcoalTips;

    if (enabled) {
      if (!this.charcoalRenderer?.isInitialized()) {
        if (!this.containerElement) return;
        this.charcoalRenderer = new CharcoalSparkRenderer();
        const success = this.charcoalRenderer.initialize(
          this.containerElement,
          this.canvasSize,
          this.canvasSize
        );
        if (success) {
          this.charcoalRenderer.setParams(this.getVM!().getCharcoalParams());
          this.renderLoopService?.updateConfig({
            charcoalRenderer: this.charcoalRenderer,
          });
        } else {
          this.charcoalRenderer = null;
        }
      }
    } else {
      if (this.charcoalRenderer?.isInitialized()) {
        this.charcoalRenderer.dispose();
        this.charcoalRenderer = null;
      }
      this.renderLoopService?.updateConfig({ charcoalRenderer: null });
      if (!this.prevHasFireTips) {
        this.fireTipTracker?.reset();
      }
    }

    // Trigger a render to start/stop charcoal loop
    this.triggerRender();
  }

  /**
   * Initialize or destroy the zap (lightning) overlay based on prevHasZapTips.
   * Mirrors syncCharcoalOverlay — the zap overlay is a Canvas2D layer that
   * draws procedural arcs between prop tips on top of fire/trails.
   */
  syncZapOverlay(): void {
    const enabled = this.prevHasZapTips;

    if (enabled) {
      if (!this.zapRenderer?.isInitialized()) {
        if (!this.containerElement) return;
        this.zapRenderer = new ZapOverlayRenderer();
        const success = this.zapRenderer.initialize(
          this.containerElement,
          this.canvasSize,
          this.canvasSize
        );
        if (success) {
          this.renderLoopService?.updateConfig({
            zapRenderer: this.zapRenderer,
          });
        } else {
          this.zapRenderer = null;
        }
      }
    } else {
      if (this.zapRenderer?.isInitialized()) {
        this.zapRenderer.dispose();
        this.zapRenderer = null;
      }
      this.renderLoopService?.updateConfig({ zapRenderer: null });
    }

    // Trigger a render to start/stop the zap loop
    this.triggerRender();
  }

  /**
   * Initialize or destroy the sparkles overlay based on prevHasSparklesTips.
   */
  syncSparklesOverlay(): void {
    const enabled = this.prevHasSparklesTips;

    if (enabled) {
      if (!this.sparklesRenderer?.isInitialized()) {
        if (!this.containerElement) return;
        this.sparklesRenderer = new SparklesOverlayRenderer();
        const success = this.sparklesRenderer.initialize(
          this.containerElement,
          this.canvasSize,
          this.canvasSize
        );
        if (success) {
          this.renderLoopService?.updateConfig({
            sparklesRenderer: this.sparklesRenderer,
          });
        } else {
          this.sparklesRenderer = null;
        }
      }
    } else {
      if (this.sparklesRenderer?.isInitialized()) {
        this.sparklesRenderer.dispose();
        this.sparklesRenderer = null;
      }
      this.renderLoopService?.updateConfig({ sparklesRenderer: null });
    }

    this.triggerRender();
  }

  /**
   * Initialize or destroy the echo overlay based on prevHasEchoTips.
   */
  syncEchoOverlay(): void {
    const enabled = this.prevHasEchoTips;

    if (enabled) {
      if (!this.echoRenderer?.isInitialized()) {
        if (!this.containerElement) return;
        this.echoRenderer = new EchoOverlayRenderer();
        const success = this.echoRenderer.initialize(
          this.containerElement,
          this.canvasSize,
          this.canvasSize
        );
        if (success) {
          this.renderLoopService?.updateConfig({
            echoRenderer: this.echoRenderer,
          });
        } else {
          this.echoRenderer = null;
        }
      }
    } else {
      if (this.echoRenderer?.isInitialized()) {
        this.echoRenderer.dispose();
        this.echoRenderer = null;
      }
      this.renderLoopService?.updateConfig({ echoRenderer: null });
    }

    this.triggerRender();
  }

  /**
   * Initialize or destroy the bloom overlay based on prevHasBloomTips.
   */
  syncBloomOverlay(): void {
    const enabled = this.prevHasBloomTips;

    if (enabled) {
      if (!this.bloomRenderer?.isInitialized()) {
        if (!this.containerElement) return;
        this.bloomRenderer = new BloomOverlayRenderer();
        const success = this.bloomRenderer.initialize(
          this.containerElement,
          this.canvasSize,
          this.canvasSize
        );
        if (success) {
          this.renderLoopService?.updateConfig({
            bloomRenderer: this.bloomRenderer,
          });
        } else {
          this.bloomRenderer = null;
        }
      }
    } else {
      if (this.bloomRenderer?.isInitialized()) {
        this.bloomRenderer.dispose();
        this.bloomRenderer = null;
      }
      this.renderLoopService?.updateConfig({ bloomRenderer: null });
    }

    this.triggerRender();
  }

  /**
   * Initialize or destroy the water overlay based on prevHasWaterTips.
   */
  syncWaterOverlay(): void {
    const enabled = this.prevHasWaterTips;

    if (enabled) {
      if (!this.waterRenderer?.isInitialized()) {
        if (!this.containerElement) return;
        this.waterRenderer = new WaterOverlayRenderer();
        const success = this.waterRenderer.initialize(
          this.containerElement,
          this.canvasSize,
          this.canvasSize
        );
        if (success) {
          this.renderLoopService?.updateConfig({
            waterRenderer: this.waterRenderer,
          });
        } else {
          this.waterRenderer = null;
        }
      }
    } else {
      if (this.waterRenderer?.isInitialized()) {
        this.waterRenderer.dispose();
        this.waterRenderer = null;
      }
      this.renderLoopService?.updateConfig({ waterRenderer: null });
    }

    this.triggerRender();
  }

  /**
   * Initialize or destroy the bubbles overlay based on prevHasBubblesTips.
   */
  syncBubblesOverlay(): void {
    const enabled = this.prevHasBubblesTips;

    if (enabled) {
      if (!this.bubblesRenderer?.isInitialized()) {
        if (!this.containerElement) return;
        this.bubblesRenderer = new BubblesOverlayRenderer();
        const success = this.bubblesRenderer.initialize(
          this.containerElement,
          this.canvasSize,
          this.canvasSize
        );
        if (success) {
          this.renderLoopService?.updateConfig({
            bubblesRenderer: this.bubblesRenderer,
          });
        } else {
          this.bubblesRenderer = null;
        }
      }
    } else {
      if (this.bubblesRenderer?.isInitialized()) {
        this.bubblesRenderer.dispose();
        this.bubblesRenderer = null;
      }
      this.renderLoopService?.updateConfig({ bubblesRenderer: null });
    }

    this.triggerRender();
  }

  /**
   * Initialize or destroy the petals overlay based on prevHasPetalsTips.
   */
  syncPetalsOverlay(): void {
    const enabled = this.prevHasPetalsTips;

    if (enabled) {
      if (!this.petalsRenderer?.isInitialized()) {
        if (!this.containerElement) return;
        this.petalsRenderer = new PetalsOverlayRenderer();
        const success = this.petalsRenderer.initialize(
          this.containerElement,
          this.canvasSize,
          this.canvasSize
        );
        if (success) {
          this.renderLoopService?.updateConfig({
            petalsRenderer: this.petalsRenderer,
          });
        } else {
          this.petalsRenderer = null;
        }
      }
    } else {
      if (this.petalsRenderer?.isInitialized()) {
        this.petalsRenderer.dispose();
        this.petalsRenderer = null;
      }
      this.renderLoopService?.updateConfig({ petalsRenderer: null });
    }

    this.triggerRender();
  }

  /**
   * Initialize or destroy the smoke overlay based on prevHasSmokeTips.
   */
  syncSmokeOverlay(): void {
    const enabled = this.prevHasSmokeTips;

    if (enabled) {
      if (!this.smokeRenderer?.isInitialized()) {
        if (!this.containerElement) return;
        this.smokeRenderer = new SmokeOverlayRenderer();
        const success = this.smokeRenderer.initialize(
          this.containerElement,
          this.canvasSize,
          this.canvasSize
        );
        if (success) {
          this.renderLoopService?.updateConfig({
            smokeRenderer: this.smokeRenderer,
          });
        } else {
          this.smokeRenderer = null;
        }
      }
    } else {
      if (this.smokeRenderer?.isInitialized()) {
        this.smokeRenderer.dispose();
        this.smokeRenderer = null;
      }
      this.renderLoopService?.updateConfig({ smokeRenderer: null });
    }

    this.triggerRender();
  }

  /**
   * Initialize or destroy the ink overlay based on prevHasInkTips.
   */
  syncInkOverlay(): void {
    const enabled = this.prevHasInkTips;

    if (enabled) {
      if (!this.inkRenderer?.isInitialized()) {
        if (!this.containerElement) return;
        this.inkRenderer = new InkOverlayRenderer();
        const success = this.inkRenderer.initialize(
          this.containerElement,
          this.canvasSize,
          this.canvasSize
        );
        if (success) {
          this.renderLoopService?.updateConfig({
            inkRenderer: this.inkRenderer,
          });
        } else {
          this.inkRenderer = null;
        }
      }
    } else {
      if (this.inkRenderer?.isInitialized()) {
        this.inkRenderer.dispose();
        this.inkRenderer = null;
      }
      this.renderLoopService?.updateConfig({ inkRenderer: null });
    }

    this.triggerRender();
  }

  syncFrostOverlay(): void {
    const enabled = this.prevHasFrostTips;

    if (enabled) {
      if (!this.frostRenderer?.isInitialized()) {
        if (!this.containerElement) return;
        this.frostRenderer = new FrostOverlayRenderer();
        const success = this.frostRenderer.initialize(
          this.containerElement,
          this.canvasSize,
          this.canvasSize
        );
        if (success) {
          this.renderLoopService?.updateConfig({
            frostRenderer: this.frostRenderer,
          });
        } else {
          this.frostRenderer = null;
        }
      }
    } else {
      if (this.frostRenderer?.isInitialized()) {
        this.frostRenderer.dispose();
        this.frostRenderer = null;
      }
      this.renderLoopService?.updateConfig({ frostRenderer: null });
    }

    this.triggerRender();
  }

  syncSilkOverlay(): void {
    const enabled = this.prevHasSilkTips;

    if (enabled) {
      if (!this.silkRenderer?.isInitialized()) {
        if (!this.containerElement) return;
        this.silkRenderer = new SilkOverlayRenderer();
        const success = this.silkRenderer.initialize(
          this.containerElement,
          this.canvasSize,
          this.canvasSize
        );
        if (success) {
          this.renderLoopService?.updateConfig({
            silkRenderer: this.silkRenderer,
          });
        } else {
          this.silkRenderer = null;
        }
      }
    } else {
      if (this.silkRenderer?.isInitialized()) {
        this.silkRenderer.dispose();
        this.silkRenderer = null;
      }
      this.renderLoopService?.updateConfig({ silkRenderer: null });
    }

    this.triggerRender();
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
    this.syncFireOverlay();

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
   */
  setCellTipEffectMap(map: TipEffectMap | undefined): void {
    this.cellTipEffectMap = map;
  }

  /**
   * Set per-cell tip effort map. When provided, this map takes priority
   * over the global visibility manager's map in getFrameParams().
   */
  setCellTipEffortMap(map: TipEffortMap | undefined): void {
    this.cellTipEffortMap = map;
  }

  // ── Layer Ordering ──────────────────────────────────────────────────

  /**
   * Push each effect's behind/front layer override to its overlay canvas.
   * Safe to call any time; renderers that aren't initialized yet are skipped.
   */
  syncEffectLayers(): void {
    const vm = this.getVM!();
    const apply = (id: string, renderer: { setCanvasZIndex?: (z: number) => void } | null) => {
      if (!renderer?.setCanvasZIndex) return;
      renderer.setCanvasZIndex(resolveEffectZ(id, vm.getEffectLayer(id)));
    };
    apply("trails", this.trailOverlay);
    apply("fire", this.fireRenderer);
    apply("charcoal", this.charcoalRenderer);
    apply("led", this.ledRenderer);
    apply("zap", this.zapRenderer);
    apply("sparkles", this.sparklesRenderer);
    apply("echo", this.echoRenderer);
    apply("bloom", this.bloomRenderer);
    apply("water", this.waterRenderer);
    apply("bubbles", this.bubblesRenderer);
    apply("petals", this.petalsRenderer);
    apply("smoke", this.smokeRenderer);
    apply("ink", this.inkRenderer);
    apply("frost", this.frostRenderer);
    apply("silk", this.silkRenderer);
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
      // eslint-disable-next-line no-console -- one-shot dev telemetry
      console.info("[TrailOverlay] using legacy Canvas2D (window.__TKA_TRAIL_GPU = false)");
      return new TrailOverlayCanvas();
    }
    return new TrailOverlayWebGL2();
  }

  // ── Resize ──────────────────────────────────────────────────────────

  /** Resize all effect overlay canvases to the new canvas size. */
  resizeAll(newSize: number): void {
    this.canvasSize = newSize;
    this.fireRenderer?.resize(newSize, newSize);
    this.ledRenderer?.resize(newSize, newSize);
    this.trailOverlay?.resize(newSize, newSize);
    this.zapRenderer?.resize(newSize, newSize);
    this.sparklesRenderer?.resize(newSize, newSize);
    this.echoRenderer?.resize(newSize, newSize);
    this.bloomRenderer?.resize(newSize, newSize);
    this.waterRenderer?.resize(newSize, newSize);
    this.bubblesRenderer?.resize(newSize, newSize);
    this.petalsRenderer?.resize(newSize, newSize);
    this.smokeRenderer?.resize(newSize, newSize);
    this.inkRenderer?.resize(newSize, newSize);
    this.frostRenderer?.resize(newSize, newSize);
    this.silkRenderer?.resize(newSize, newSize);
    this.charcoalRenderer?.resize(newSize, newSize);
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
    if (this.fireRenderer?.isInitialized() && this.renderLoopService) {
      this.renderLoopService.updateConfig({
        fireRenderer: this.fireRenderer,
      });
    } else if (this.charcoalRenderer?.isInitialized() && this.renderLoopService) {
      this.renderLoopService.updateConfig({
        charcoalRenderer: this.charcoalRenderer,
      });
    }
    if (this.ledRenderer?.isInitialized() && this.renderLoopService) {
      this.renderLoopService.updateConfig({
        ledRenderer: this.ledRenderer,
      });
    }
    if (this.zapRenderer?.isInitialized() && this.renderLoopService) {
      this.renderLoopService.updateConfig({
        zapRenderer: this.zapRenderer,
      });
    }
  }

  /**
   * Ensure overlays that should be enabled are actually created.
   * Called at end of initialize() in case $effects haven't triggered yet.
   */
  ensureEnabledOverlays(): void {
    if (this.prevHasFireTips && !this.fireRenderer?.isInitialized()) {
      this.syncFireOverlay();
    }
    if (this.prevHasCharcoalTips && !this.charcoalRenderer?.isInitialized()) {
      this.syncCharcoalOverlay();
    }
    if (this.ledConfig.enabled && !this.ledRenderer?.isInitialized()) {
      this.syncLedOverlay();
    }
    if (this.prevHasZapTips && !this.zapRenderer?.isInitialized()) {
      this.syncZapOverlay();
    }
    if (this.prevHasSparklesTips && !this.sparklesRenderer?.isInitialized()) {
      this.syncSparklesOverlay();
    }
    if (this.prevHasEchoTips && !this.echoRenderer?.isInitialized()) {
      this.syncEchoOverlay();
    }
    if (this.prevHasBloomTips && !this.bloomRenderer?.isInitialized()) {
      this.syncBloomOverlay();
    }
    if (this.prevHasWaterTips && !this.waterRenderer?.isInitialized()) {
      this.syncWaterOverlay();
    }
    if (this.prevHasBubblesTips && !this.bubblesRenderer?.isInitialized()) {
      this.syncBubblesOverlay();
    }
    if (this.prevHasPetalsTips && !this.petalsRenderer?.isInitialized()) {
      this.syncPetalsOverlay();
    }
    if (this.prevHasSmokeTips && !this.smokeRenderer?.isInitialized()) {
      this.syncSmokeOverlay();
    }
    if (this.prevHasInkTips && !this.inkRenderer?.isInitialized()) {
      this.syncInkOverlay();
    }
    if (this.prevHasFrostTips && !this.frostRenderer?.isInitialized()) {
      this.syncFrostOverlay();
    }
    if (this.prevHasSilkTips && !this.silkRenderer?.isInitialized()) {
      this.syncSilkOverlay();
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
    const ledEnabled = vm.hasEffect("led");
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
    // Dispose fire overlay
    this.fireRenderer?.dispose();
    this.fireRenderer = null;
    this.charcoalRenderer?.dispose();
    this.charcoalRenderer = null;
    this.fireTipTracker = null;

    // Dispose LED overlay (also prevent any pending deferred init from running)
    this.ledConfig.enabled = false;
    this.ledRenderer?.dispose();
    this.ledRenderer = null;
    this.ledTipTracker = null;

    // Dispose trail overlay
    this.trailOverlay?.dispose();
    this.trailOverlay = null;

    // Dispose zap overlay
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
  }

  // ── Private helpers ─────────────────────────────────────────────────

  private triggerRender(): void {
    if (this.renderLoopService && this.getFrameParams) {
      this.renderLoopService.triggerRender(this.getFrameParams);
    }
  }
}
