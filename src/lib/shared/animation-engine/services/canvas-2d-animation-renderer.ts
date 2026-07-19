/**
 * @deprecated Superseded by render-graph system (src/lib/shared/render-graph/).
 * The WebGL2Backend + WebGPUBackend handle prop rendering via the unified
 * FrameGraph. This file remains as the default code path until the
 * render-graph is promoted from behind its feature flag.
 *
 * Canvas2D Animation Renderer Implementation
 *
 * Pure Canvas2D renderer for animation visualization.
 * Replaces PixiJS WebGL rendering with simpler, leak-free Canvas2D.
 *
 * Why Canvas2D over PixiJS:
 * - Zero external dependencies
 * - No WebGL context management/loss issues
 * - Simpler memory lifecycle (no texture caching)
 * - Sufficient performance for ~10 sprites
 * - Easier debugging
 *
 * Architecture:
 * This class delegates to specialized services following SRP:
 * - Canvas2DApplicationManager: Canvas lifecycle and management
 * - Canvas2DImageLoader: SVG→Image conversion and caching
 * - Canvas2DTrailRenderer: Trail rendering logic
 * - Canvas2DFadeManager: Glyph fade transitions
 * - Canvas2DGridFadeManager: Grid visibility toggle transitions
 * - Canvas2DVisibilityFadeManager: Props and trails visibility transitions
 */

import type { RenderedPropTransform } from "$lib/shared/animation-engine/domain/types/fire-types";
import type {
} from "$lib/shared/animation-engine/domain/types/trail-types";
import type {
  RenderSceneParams,
} from "$lib/shared/animation-engine/domain/types/animation-render-types";

export type {
  AdditionalLayerRenderData,
  AnimationVisibilitySettings,
  RenderSceneParams,
} from "$lib/shared/animation-engine/domain/types/animation-render-types";
import { spotlightFactor } from "$lib/shared/sequence-viewer/tunnel/tunnel-prop-colors";
import { Canvas2DApplicationManager } from "$lib/shared/animation-engine/services/canvas2d/canvas-2d-application-manager";
import { Canvas2DImageLoader } from "$lib/shared/animation-engine/services/canvas2d/canvas-2d-image-loader";
import { Canvas2DTrailRenderer } from "$lib/shared/animation-engine/services/canvas2d/canvas-2d-trail-renderer";
import { Canvas2DFadeManager } from "$lib/shared/animation-engine/services/canvas2d/canvas-2d-fade-manager";
import { Canvas2DGridFadeManager } from "$lib/shared/animation-engine/services/canvas2d/canvas-2d-grid-fade-manager";
import { Canvas2DVisibilityFadeManager } from "./canvas2d/canvas-2d-visibility-fade-manager";
import {
  easeInOutCosine,
  propMorphOutgoingScale,
  propMorphIncomingScale,
  propMorphGlowBlur,
} from "./canvas2d/prop-morph-easing";
import { getMotionColor } from "$lib/shared/utils/svg-color-utils";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

// Constants matching AnimatorCanvas EXACTLY
const VIEWBOX_SIZE = 950;
const GRID_HALFWAY_POINT_OFFSET = 150; // Strict hand points (animation mode)
const INWARD_FACTOR = 1.0; // No inward adjustment - use exact grid coordinates

// ─── Screen-space sphere shading for spherical props ─────────────────
interface SphereDefinition {
  cx: number;
  cy: number;
  r: number;
}

interface SphereMaterial {
  edgeDarkness: number;
  specularIntensity: number;
  specularRadius: number;
}

interface SphereLayout {
  spheres: SphereDefinition[];
  viewBoxWidth: number;
  viewBoxHeight: number;
  material?: SphereMaterial;
}

// Sphere layouts by size+count (independent of material)
const SPHERE_LAYOUTS = {
  single: {
    spheres: [{ cx: 225, cy: 75, r: 75 }],
    viewBoxWidth: 300,
    viewBoxHeight: 150,
  },
  double: {
    spheres: [
      { cx: 75, cy: 75, r: 75 },
      { cx: 225, cy: 75, r: 75 },
    ],
    viewBoxWidth: 300,
    viewBoxHeight: 150,
  },
  bigsingle: {
    spheres: [{ cx: 450, cy: 150, r: 150 }],
    viewBoxWidth: 600,
    viewBoxHeight: 300,
  },
  bigdouble: {
    spheres: [
      { cx: 150, cy: 150, r: 150 },
      { cx: 450, cy: 150, r: 150 },
    ],
    viewBoxWidth: 600,
    viewBoxHeight: 300,
  },
};

// Default material (also used for "contact" standard balls)
const DEFAULT_SPHERE_MATERIAL: SphereMaterial = {
  edgeDarkness: 0.35,
  specularIntensity: 0.35,
  specularRadius: 0.4,
};

// Materials by surface type (independent of size/count)
const SPHERE_MATERIALS: Record<string, SphereMaterial> = {
  contact: DEFAULT_SPHERE_MATERIAL,
  glass: DEFAULT_SPHERE_MATERIAL,
  pmma: { edgeDarkness: 0.35, specularIntensity: 0.5, specularRadius: 0.4 },
  frosted: { edgeDarkness: 0.35, specularIntensity: 0.2, specularRadius: 0.6 },
};

// Pattern: {big?}{double?}{material}ball - parse any combination
const SPHERE_PROP_PATTERN = /^(big)?(double)?(contact|glass|pmma|frosted)ball$/;

function getSphereLayout(propType: string): SphereLayout | null {
  const match = propType.toLowerCase().match(SPHERE_PROP_PATTERN);
  if (!match) return null;

  const isBig = !!match[1];
  const isDouble = !!match[2];
  const materialKey = match[3]!;

  const layoutKey = (isBig ? "big" : "") + (isDouble ? "double" : "single");
  const base = SPHERE_LAYOUTS[layoutKey as keyof typeof SPHERE_LAYOUTS];
  const material = SPHERE_MATERIALS[materialKey] ?? DEFAULT_SPHERE_MATERIAL;

  return { ...base, material };
}

export class Canvas2DAnimationRenderer {
  // Specialized service managers
  private appManager: Canvas2DApplicationManager;
  private imageLoader: Canvas2DImageLoader;
  private trailRenderer: Canvas2DTrailRenderer;
  private fadeManager: Canvas2DFadeManager;
  private gridFadeManager: Canvas2DGridFadeManager;
  private propsFadeManager: Canvas2DVisibilityFadeManager;
  private bluePropFadeManager: Canvas2DVisibilityFadeManager;
  private redPropFadeManager: Canvas2DVisibilityFadeManager;
  private trailsFadeManager: Canvas2DVisibilityFadeManager;
  // Prop-type hot-swap morph crossfade (previous sprite -> new sprite at the
  // same transform). Independent per color so blue can morph while red holds
  // steady. Distinct from bluePropFadeManager/redPropFadeManager above, which
  // fade prop VISIBILITY (motion toggles), not a sprite swap.
  private bluePropMorphFadeManager: Canvas2DFadeManager;
  private redPropMorphFadeManager: Canvas2DFadeManager;

  private lastBlueTransform: RenderedPropTransform | null = null;
  private lastRedTransform: RenderedPropTransform | null = null;

  // Track current grid mode for resize operations
  private currentGridMode: string = "diamond";

  // Cached off-white tinted grid for dark mode. ctx.filter("invert") is
  // silently ignored on iOS Safari, leaving the grid pure black and invisible
  // on the dark canvas. We pre-tint the grid on an offscreen canvas instead
  // (drawImage + "source-in" fill), which iOS does support. Rebuilt only when
  // the source grid image or canvas size changes.
  private tintedGridCanvas: HTMLCanvasElement | null = null;
  private tintedGridImageRef: HTMLImageElement | null = null;
  private tintedGridSize = 0;

  constructor() {
    this.appManager = new Canvas2DApplicationManager();
    this.imageLoader = new Canvas2DImageLoader();
    this.trailRenderer = new Canvas2DTrailRenderer();
    this.fadeManager = new Canvas2DFadeManager();
    this.gridFadeManager = new Canvas2DGridFadeManager();
    this.propsFadeManager = new Canvas2DVisibilityFadeManager(300, 200);
    // Individual blue/red fade managers use same timing for coordinated animation
    this.bluePropFadeManager = new Canvas2DVisibilityFadeManager(300, 200);
    this.redPropFadeManager = new Canvas2DVisibilityFadeManager(300, 200);
    this.trailsFadeManager = new Canvas2DVisibilityFadeManager(350, 250);
    // 900ms: a whole-shape prop swap has to READ as a transformation, not a
    // flash. 400ms proved imperceptible in practice (2026-07-19, homepage
    // attract act: the fade completed inside the post-swap start hold and the
    // handoff still read as a pop). The fade never blocks motion — it only
    // blends sprites at the live transform — so the longer window costs
    // nothing except being visible, which is the point.
    this.bluePropMorphFadeManager = new Canvas2DFadeManager(900);
    this.redPropMorphFadeManager = new Canvas2DFadeManager(900);
  }

  /**
   * Return an off-white tinted copy of the grid image for dark mode.
   *
   * Uses an offscreen canvas with "source-in" compositing rather than
   * ctx.filter — iOS Safari silently ignores CanvasRenderingContext2D.filter,
   * which left the grid pure black (invisible) on the dark animation canvas.
   * #d9d9d9 matches the old invert(0.85) output (0.85 * 255 ≈ 217). Cached
   * across frames; rebuilt only when the source image or size changes.
   */
  private getTintedGrid(
    gridImage: HTMLImageElement,
    canvasSize: number
  ): HTMLCanvasElement | null {
    if (
      this.tintedGridCanvas &&
      this.tintedGridImageRef === gridImage &&
      this.tintedGridSize === canvasSize
    ) {
      return this.tintedGridCanvas;
    }

    const offscreen = this.tintedGridCanvas ?? document.createElement("canvas");
    offscreen.width = canvasSize;
    offscreen.height = canvasSize;
    const offCtx = offscreen.getContext("2d");
    if (!offCtx) return null;

    offCtx.clearRect(0, 0, canvasSize, canvasSize);
    // 1. Draw the grid (black ink) as an alpha mask.
    offCtx.drawImage(gridImage, 0, 0, canvasSize, canvasSize);
    // 2. Recolor only the drawn pixels to off-white.
    offCtx.globalCompositeOperation = "source-in";
    offCtx.fillStyle = "#d9d9d9";
    offCtx.fillRect(0, 0, canvasSize, canvasSize);
    offCtx.globalCompositeOperation = "source-over";

    this.tintedGridCanvas = offscreen;
    this.tintedGridImageRef = gridImage;
    this.tintedGridSize = canvasSize;
    return offscreen;
  }

  async initialize(
    container: HTMLElement,
    size: number,
    backgroundAlpha: number = 1,
    paintBackground: boolean = true
  ): Promise<void> {
    await this.appManager.initialize(container, size, backgroundAlpha, paintBackground);
  }

  async resize(newSize: number): Promise<void> {
    this.appManager.resize(newSize);

    // Reload grid image at new canvas size
    await this.loadGridTexture(this.currentGridMode);
  }

  async loadPropTextures(propType: string): Promise<void> {
    await this.imageLoader.loadPropImages(propType);
  }

  async loadPerColorPropTextures(
    bluePropType: string,
    redPropType: string,
    darkMode?: boolean
  ): Promise<void> {
    await this.imageLoader.loadPerColorPropImages(
      bluePropType,
      redPropType,
      darkMode
    );
  }

  /**
   * Start the blue-hand prop morph crossfade. Called by PropTypeManager from
   * a genuine hot-swap site only, once the new texture has already loaded —
   * never from the initial load or a dark-mode-only reload. No-op if the
   * image loader has no previous blue sprite to fade from (nothing swapped).
   */
  startBluePropMorphFade(): void {
    if (this.imageLoader.getPreviousBluePropImage()) {
      this.bluePropMorphFadeManager.startFadeTransition();
    }
  }

  /** Red-hand counterpart of startBluePropMorphFade. */
  startRedPropMorphFade(): void {
    if (this.imageLoader.getPreviousRedPropImage()) {
      this.redPropMorphFadeManager.startFadeTransition();
    }
  }

  /**
   * True while the blue-hand prop morph crossfade is actively running.
   * Consumed by the trail overlay (via AnimationRenderLoop) to suppress new
   * tip captures for that color during the fade — the tip's screen position
   * jumps between prop types' differing tip geometry, and stamping through
   * that jump is what drew the reported straight-line artifact.
   */
  isBluePropMorphFadeInProgress(): boolean {
    return this.bluePropMorphFadeManager.isFadingInProgress();
  }

  /** Red-hand counterpart of isBluePropMorphFadeInProgress. */
  isRedPropMorphFadeInProgress(): boolean {
    return this.redPropMorphFadeManager.isFadingInProgress();
  }

  async loadAdditionalLayerPropTextures(
    layerIndex: number,
    bluePropType: string,
    redPropType: string,
    blueColor: string,
    redColor: string
  ): Promise<void> {
    await this.imageLoader.loadAdditionalLayerPropImages(
      layerIndex,
      bluePropType,
      redPropType,
      blueColor,
      redColor
    );
  }

  async loadGridTexture(gridMode: string, showNonRadialPoints: boolean = true): Promise<void> {
    this.currentGridMode = gridMode;
    const canvasSize = this.appManager.getCurrentSize();
    await this.imageLoader.loadGridImage(gridMode, canvasSize, showNonRadialPoints);
  }

  /**
   * Set Dark Mode for dark background
   * @param animate - Whether to animate the transition (default: true)
   */
  setDarkMode(enabled: boolean, animate: boolean = true): void {
    this.appManager.setDarkMode(enabled, animate);
  }

  /**
   * Check if any element is currently transitioning
   * Used by render loop to continue rendering during smooth transitions
   */
  isBackgroundTransitioning(): boolean {
    return (
      this.appManager.isBackgroundTransitioning() ||
      this.gridFadeManager.isTransitionInProgress() ||
      this.propsFadeManager.isTransitionInProgress() ||
      this.bluePropFadeManager.isTransitionInProgress() ||
      this.redPropFadeManager.isTransitionInProgress() ||
      this.trailsFadeManager.isTransitionInProgress() ||
      this.bluePropMorphFadeManager.isFadingInProgress() ||
      this.redPropMorphFadeManager.isFadingInProgress()
    );
  }

  async loadGlyphTexture(
    svgString: string,
    width: number,
    height: number
  ): Promise<void> {
    const { previous } = await this.imageLoader.loadGlyphImage(
      svgString,
      width,
      height
    );

    // Start fade transition if there's a previous glyph
    if (previous) {
      this.fadeManager.startFadeTransition();
    }
  }

  renderScene(params: RenderSceneParams): void {
    const ctx = this.appManager.getContext();
    if (!ctx || !this.appManager.isReady()) {
      return;
    }

    const canvasSize = this.appManager.getCurrentSize();
    this.lastBlueTransform = null;
    this.lastRedTransform = null;
    const gridScaleFactor = canvasSize / VIEWBOX_SIZE;

    // 1. Clear canvas and fill background
    this.appManager.clear();

    // 2. Draw grid (with fade transition for toggle)
    this.gridFadeManager.setVisible(params.visibility.gridVisible);
    const gridFadeState = this.gridFadeManager.updateProgress(
      params.currentTime
    );
    const gridImage = this.imageLoader.getGridImage();

    // Draw grid if alpha > 0 (either visible, or fading out)
    if (gridFadeState.alpha > 0 && gridImage) {
      ctx.save();
      ctx.globalAlpha = gridFadeState.alpha;

      // In Dark Mode the grid (black ink) must render off-white. ctx.filter is
      // unsupported on iOS Safari, so we draw a pre-tinted offscreen copy
      // instead of inverting at draw time (which left the grid black on iPhone).
      const isDarkMode = this.appManager.isDarkModeEnabled();
      const tinted = isDarkMode
        ? this.getTintedGrid(gridImage, canvasSize)
        : null;
      ctx.drawImage(tinted ?? gridImage, 0, 0, canvasSize, canvasSize);
      ctx.restore();
    }

    // 3. Draw trails (with fade transition for toggle)
    this.trailsFadeManager.setVisible(params.visibility.trailsVisible);
    const trailsFadeState = this.trailsFadeManager.updateProgress(
      params.currentTime
    );

    if (trailsFadeState.alpha > 0 && !params.skipTrailRendering) {
      ctx.save();
      ctx.globalAlpha = trailsFadeState.alpha;
      this.trailRenderer.renderTrails(
        ctx,
        params.blueTrailPoints,
        params.redTrailPoints,
        params.trailSettings,
        params.currentTime,
        !!params.blueProp && params.visibility.blueMotionVisible,
        !!params.redProp && params.visibility.redMotionVisible,
        canvasSize,
        params.qualityHints,
        params.additionalLayers
      );
      ctx.restore();
    }

    // 4. Draw props (with fade transitions for toggles)
    // Overall props toggle affects all props
    this.propsFadeManager.setVisible(
      params.visibility.propsVisible && !params.trailSettings.hideProps
    );
    const propsFadeState = this.propsFadeManager.updateProgress(
      params.currentTime
    );

    // Individual motion toggles for blue/red (combined with overall props alpha)
    this.bluePropFadeManager.setVisible(params.visibility.blueMotionVisible);
    this.redPropFadeManager.setVisible(params.visibility.redMotionVisible);
    const blueFadeState = this.bluePropFadeManager.updateProgress(
      params.currentTime
    );
    const redFadeState = this.redPropFadeManager.updateProgress(
      params.currentTime
    );

    // Blue props: render if either fade has alpha > 0
    const blueAlpha = propsFadeState.alpha * blueFadeState.alpha;
    // Performer spotlight: base = family 0, layer i = family i+1. Dims the prop
    // glyph of every non-selected copy so the chosen performer stands out.
    const selectedLayer = params.tunnelSelectedLayer ?? null;
    if (blueAlpha > 0 && params.blueProp) {
      ctx.save();
      const blueBaseAlpha = blueAlpha * spotlightFactor(selectedLayer, 0);
      ctx.globalAlpha = blueBaseAlpha;

      // Primary blue prop. On a prop-type hot-swap, cross-fade the previous
      // sprite into the new one at the SAME transform (same propState +
      // dimensions + canvasSize drive both renderProp calls below), which is
      // what reads as the prop morphing in the hand instead of a hard cut.
      const bluePropImage = this.imageLoader.getBluePropImage();
      const previousBluePropImage = this.imageLoader.getPreviousBluePropImage();
      const blueMorphFade = this.bluePropMorphFadeManager.updateFadeProgress(
        params.currentTime
      );
      if (bluePropImage) {
        const blueTransform = this.calculatePropTransform(params.blueProp, params.bluePropDimensions, canvasSize);
        this.lastBlueTransform = {
          centerX: blueTransform.x,
          centerY: blueTransform.y,
          angle: params.bluePropType?.toLowerCase() === "hand" ? 0 : blueTransform.rotation,
          scaleFactor: gridScaleFactor,
        };

        if (previousBluePropImage && !blueMorphFade.isComplete) {
          // Ease the raw linear fade progress once, then drive alpha, scale,
          // AND the glow pulse off the SAME eased value — a single coherent
          // "morph phase" rather than three independently-timed curves. This
          // is what makes it read as one transformation instead of a plain
          // crossfade: the outgoing sprite dissolves outward (scales up as it
          // fades), the incoming sprite condenses into place (scales up from
          // below 1 as it fades in) and pulses a glow at the midpoint.
          const blueEased = easeInOutCosine(blueMorphFade.currentAlpha);
          const outgoingScale = propMorphOutgoingScale(blueEased);
          const incomingScale = propMorphIncomingScale(blueEased);
          const glowBlur = propMorphGlowBlur(blueEased, canvasSize, VIEWBOX_SIZE);

          ctx.globalAlpha = blueBaseAlpha * (1 - blueEased);
          this.renderProp(
            ctx,
            params.blueProp,
            previousBluePropImage,
            params.bluePropDimensions,
            canvasSize,
            params.bluePropFlipped ?? false,
            params.bluePropType,
            outgoingScale
          );
          ctx.globalAlpha = blueBaseAlpha * blueEased;
          this.renderProp(
            ctx,
            params.blueProp,
            bluePropImage,
            params.bluePropDimensions,
            canvasSize,
            params.bluePropFlipped ?? false,
            params.bluePropType,
            incomingScale,
            { blur: glowBlur, color: getMotionColor(MotionColor.BLUE, "dark") }
          );
        } else {
          this.renderProp(
            ctx,
            params.blueProp,
            bluePropImage,
            params.bluePropDimensions,
            canvasSize,
            params.bluePropFlipped ?? false,
            params.bluePropType
          );
        }
        // Restore the base alpha — sphere shading and tunnel layers below are
        // not part of the morph and must render at full (unfaded) alpha.
        ctx.globalAlpha = blueBaseAlpha;
      }
      if (blueMorphFade.isComplete && previousBluePropImage) {
        this.imageLoader.clearPreviousBluePropImage();
      }

      // Screen-space sphere shading (stays fixed as prop rotates)
      if (params.bluePropType) {
        this.renderSphereShading(ctx, params.blueProp, params.bluePropDimensions, canvasSize, params.bluePropType);
      }

      // Additional tunnel layer blue props — tinted to their spectrum color so
      // each kaleidoscope copy is distinct (blue family fans blue→green). Each
      // layer draws at its OWN intrinsic dimensions (a performer's per-hand prop
      // may be a different shape than the base pair), falling back to the base
      // dimensions before its texture has loaded.
      if (params.additionalLayers) {
        const layerCount = params.additionalLayers.length;
        for (let i = 0; i < layerCount; i++) {
          const layer = params.additionalLayers[i]!;
          if (layer.blueProp && layer.hasBlue) {
            const layerImages = this.imageLoader.getAdditionalLayerImages(i);
            if (layerImages.blue) {
              const dims = this.imageLoader.getAdditionalLayerDimensions(i);
              ctx.globalAlpha = blueAlpha * spotlightFactor(selectedLayer, i + 1);
              this.renderProp(
                ctx,
                layer.blueProp,
                layerImages.blue,
                dims?.blue ?? params.bluePropDimensions,
                canvasSize,
                params.bluePropFlipped ?? false,
                layer.bluePropType ?? params.bluePropType
              );
            }
          }
        }
      }

      ctx.restore();
    }

    // Red props: render if either fade has alpha > 0
    const redAlpha = propsFadeState.alpha * redFadeState.alpha;
    if (redAlpha > 0 && params.redProp) {
      ctx.save();
      const redBaseAlpha = redAlpha * spotlightFactor(selectedLayer, 0);
      ctx.globalAlpha = redBaseAlpha;

      // Primary red prop — same morph cross-fade treatment as blue above.
      const redPropImage = this.imageLoader.getRedPropImage();
      const previousRedPropImage = this.imageLoader.getPreviousRedPropImage();
      const redMorphFade = this.redPropMorphFadeManager.updateFadeProgress(
        params.currentTime
      );
      if (redPropImage) {
        const redTransform = this.calculatePropTransform(params.redProp, params.redPropDimensions, canvasSize);
        this.lastRedTransform = {
          centerX: redTransform.x,
          centerY: redTransform.y,
          angle: params.redPropType?.toLowerCase() === "hand" ? 0 : redTransform.rotation,
          scaleFactor: gridScaleFactor,
        };

        if (previousRedPropImage && !redMorphFade.isComplete) {
          // Same eased "morph phase" treatment as blue above — see its comment.
          const redEased = easeInOutCosine(redMorphFade.currentAlpha);
          const outgoingScale = propMorphOutgoingScale(redEased);
          const incomingScale = propMorphIncomingScale(redEased);
          const glowBlur = propMorphGlowBlur(redEased, canvasSize, VIEWBOX_SIZE);

          ctx.globalAlpha = redBaseAlpha * (1 - redEased);
          this.renderProp(
            ctx,
            params.redProp,
            previousRedPropImage,
            params.redPropDimensions,
            canvasSize,
            params.redPropFlipped ?? false,
            params.redPropType,
            outgoingScale
          );
          ctx.globalAlpha = redBaseAlpha * redEased;
          this.renderProp(
            ctx,
            params.redProp,
            redPropImage,
            params.redPropDimensions,
            canvasSize,
            params.redPropFlipped ?? false,
            params.redPropType,
            incomingScale,
            { blur: glowBlur, color: getMotionColor(MotionColor.RED, "dark") }
          );
        } else {
          this.renderProp(
            ctx,
            params.redProp,
            redPropImage,
            params.redPropDimensions,
            canvasSize,
            params.redPropFlipped ?? false,
            params.redPropType
          );
        }
        ctx.globalAlpha = redBaseAlpha;
      }
      if (redMorphFade.isComplete && previousRedPropImage) {
        this.imageLoader.clearPreviousRedPropImage();
      }

      // Screen-space sphere shading (stays fixed as prop rotates)
      if (params.redPropType) {
        this.renderSphereShading(ctx, params.redProp, params.redPropDimensions, canvasSize, params.redPropType);
      }

      // Additional tunnel layer red props — tinted to their spectrum color so
      // each kaleidoscope copy is distinct (red family fans red→magenta). Own
      // intrinsic dimensions per performer, base fallback before texture load.
      if (params.additionalLayers) {
        const layerCount = params.additionalLayers.length;
        for (let i = 0; i < layerCount; i++) {
          const layer = params.additionalLayers[i]!;
          if (layer.redProp && layer.hasRed) {
            const layerImages = this.imageLoader.getAdditionalLayerImages(i);
            if (layerImages.red) {
              const dims = this.imageLoader.getAdditionalLayerDimensions(i);
              ctx.globalAlpha = redAlpha * spotlightFactor(selectedLayer, i + 1);
              this.renderProp(
                ctx,
                layer.redProp,
                layerImages.red,
                dims?.red ?? params.redPropDimensions,
                canvasSize,
                params.redPropFlipped ?? false,
                layer.redPropType ?? params.redPropType
              );
            }
          }
        }
      }

      ctx.restore();
    }

    // 5. Draw glyph (with fade transition)
    this.renderGlyph(ctx, params.currentTime, canvasSize);
  }

  getLastPropTransforms(): { blue: RenderedPropTransform | null; red: RenderedPropTransform | null } {
    return { blue: this.lastBlueTransform, red: this.lastRedTransform };
  }

  /** Current prop sprite images — the echo overlay ghosts these at past poses. */
  getPropImages(): { blue: HTMLImageElement | null; red: HTMLImageElement | null } {
    return {
      blue: this.imageLoader.getBluePropImage(),
      red: this.imageLoader.getRedPropImage(),
    };
  }

  /**
   * Render a prop at its calculated position with rotation
   * @param flipped - Whether to mirror the prop horizontally (for asymmetric props like Buugeng)
   * @param propType - The type of prop being rendered (used for prop-specific rules like hands never rotating)
   * @param scaleMultiplier - Scales ONLY the drawn width/height (both halves of the
   *   centered drawImage offset), so the sprite grows/shrinks about its own center
   *   without touching translate/rotate/position. Default 1 = no change (the morph
   *   crossfade is the only caller that passes a non-1 value).
   * @param glow - Optional shadow (blur + color) applied to this draw only. Scoped
   *   by the surrounding ctx.save()/restore() pair, so it never leaks to whatever
   *   renders next — the morph's incoming-sprite glow pulse.
   */
  private renderProp(
    ctx: CanvasRenderingContext2D,
    propState: {
      centerPathAngle: number;
      staffRotationAngle: number;
      x?: number;
      y?: number;
    },
    image: HTMLImageElement | null,
    dimensions: { width: number; height: number },
    canvasSize: number,
    flipped: boolean = false,
    propType?: string,
    scaleMultiplier: number = 1,
    glow?: { blur: number; color: string }
  ): void {
    if (!image) return;

    // Every prop sprite (base pair and tunnel layers) is already colored through
    // the selective SVG pipeline, so it draws as-is — no per-pixel recolor.
    const drawSource: CanvasImageSource = image;

    const transform = this.calculatePropTransform(
      propState,
      dimensions,
      canvasSize
    );

    // IMPORTANT: Hands should never rotate - always use default orientation (0 degrees)
    // This matches the static pictograph behavior in PropPlacer.ts
    const rotation =
      propType?.toLowerCase() === "hand" ? 0 : transform.rotation;

    ctx.save();
    ctx.translate(transform.x, transform.y);
    ctx.rotate(rotation);

    // Apply horizontal flip for asymmetric props (Buugeng family)
    if (flipped) {
      ctx.scale(-1, 1);
    }

    if (glow && glow.blur > 0) {
      ctx.shadowBlur = glow.blur;
      ctx.shadowColor = glow.color;
    }

    // Scaling both the drawn size AND its centered offset by the same factor
    // keeps the sprite centered on the translate origin — this is what makes
    // the scale read as "about its own center" rather than shifting position.
    const drawWidth = transform.width * scaleMultiplier;
    const drawHeight = transform.height * scaleMultiplier;
    ctx.drawImage(
      drawSource,
      -drawWidth / 2,
      -drawHeight / 2,
      drawWidth,
      drawHeight
    );

    if (glow && glow.blur > 0) {
      // Belt-and-suspenders: ctx.restore() below already reverts shadow state,
      // but clear it explicitly so nothing between here and restore() (there is
      // nothing today, but this is the load-bearing line if that ever changes)
      // can inherit it.
      ctx.shadowBlur = 0;
      ctx.shadowColor = "transparent";
    }

    ctx.restore();
  }

  /**
   * Draw screen-space sphere shading (edge darkening + specular highlight)
   * at each sub-sphere's position WITHOUT rotation, so the highlight
   * stays fixed relative to the viewer as the prop spins.
   */
  private renderSphereShading(
    ctx: CanvasRenderingContext2D,
    propState: {
      centerPathAngle: number;
      staffRotationAngle: number;
      x?: number;
      y?: number;
    },
    dimensions: { width: number; height: number },
    canvasSize: number,
    propType: string
  ): void {
    const config = getSphereLayout(propType);
    if (!config) return;

    const transform = this.calculatePropTransform(
      propState,
      dimensions,
      canvasSize
    );
    const gridScaleFactor = canvasSize / VIEWBOX_SIZE;
    const rotation = transform.rotation;
    const material = config.material ?? DEFAULT_SPHERE_MATERIAL;

    const vbCenterX = config.viewBoxWidth / 2;
    const vbCenterY = config.viewBoxHeight / 2;
    const cosR = Math.cos(rotation);
    const sinR = Math.sin(rotation);

    for (const sphere of config.spheres) {
      // Sphere offset from viewBox center, scaled to canvas space
      const offsetX = (sphere.cx - vbCenterX) * gridScaleFactor;
      const offsetY = (sphere.cy - vbCenterY) * gridScaleFactor;

      // Rotate offset by prop rotation to get screen position
      const screenX = transform.x + offsetX * cosR - offsetY * sinR;
      const screenY = transform.y + offsetX * sinR + offsetY * cosR;
      const screenR = sphere.r * gridScaleFactor;

      // Edge darkening: centered radial gradient, transparent core → dark rim
      const edgeGrad = ctx.createRadialGradient(
        screenX,
        screenY,
        screenR * 0.7,
        screenX,
        screenY,
        screenR
      );
      edgeGrad.addColorStop(0, "rgba(0,0,0,0)");
      edgeGrad.addColorStop(1, `rgba(0,0,0,${material.edgeDarkness})`);
      ctx.fillStyle = edgeGrad;
      ctx.beginPath();
      ctx.arc(screenX, screenY, screenR, 0, Math.PI * 2);
      ctx.fill();

      // Specular highlight: off-center at fixed upper-left, no rotation
      const specCenterX = screenX + -0.3 * screenR;
      const specCenterY = screenY + -0.3 * screenR;
      const specGradRadius = material.specularRadius * screenR;

      const specGrad = ctx.createRadialGradient(
        specCenterX,
        specCenterY,
        0,
        specCenterX,
        specCenterY,
        specGradRadius
      );
      specGrad.addColorStop(
        0,
        `rgba(255,255,255,${material.specularIntensity})`
      );
      specGrad.addColorStop(
        0.4,
        `rgba(255,255,255,${(material.specularIntensity * 0.23).toFixed(3)})`
      );
      specGrad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = specGrad;
      ctx.beginPath();
      ctx.arc(screenX, screenY, screenR, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * Calculate prop position and dimensions
   * Matches PixiPropRenderer logic for consistency
   */
  private calculatePropTransform(
    propState: {
      centerPathAngle: number;
      staffRotationAngle: number;
      x?: number;
      y?: number;
    },
    propDimensions: { width: number; height: number },
    canvasSize: number
  ): {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
  } {
    const centerX = canvasSize / 2;
    const centerY = canvasSize / 2;
    const gridScaleFactor = canvasSize / VIEWBOX_SIZE;
    const scaledHalfwayRadius = GRID_HALFWAY_POINT_OFFSET * gridScaleFactor;

    let x: number, y: number;

    if (propState.x !== undefined && propState.y !== undefined) {
      // Dash motion: use Cartesian coordinates
      x = centerX + propState.x * scaledHalfwayRadius * INWARD_FACTOR;
      y = centerY + propState.y * scaledHalfwayRadius * INWARD_FACTOR;
    } else {
      // Regular motion: calculate from angle
      x =
        centerX +
        Math.cos(propState.centerPathAngle) *
          scaledHalfwayRadius *
          INWARD_FACTOR;
      y =
        centerY +
        Math.sin(propState.centerPathAngle) *
          scaledHalfwayRadius *
          INWARD_FACTOR;
    }

    // Scale prop dimensions
    const propWidth = propDimensions.width * gridScaleFactor;
    const propHeight = propDimensions.height * gridScaleFactor;

    return {
      x,
      y,
      width: propWidth,
      height: propHeight,
      rotation: propState.staffRotationAngle,
    };
  }

  /**
   * Render glyph with fade transition support
   */
  private renderGlyph(
    ctx: CanvasRenderingContext2D,
    currentTime: number,
    canvasSize: number
  ): void {
    const currentImage = this.imageLoader.getGlyphImage();
    const previousImage = this.imageLoader.getPreviousGlyphImage();

    // Get fade state
    const fadeState = this.fadeManager.updateFadeProgress(currentTime);

    // Dark-mode glyph recoloring is baked into the serialized glyph SVG itself
    // (TKAGlyph swaps the letter <image> to a white-recolored source), so the
    // canvas draws the image as-is. The live viewer's glyph is the DOM overlay.

    // Draw previous glyph (fading out)
    if (previousImage && !fadeState.isComplete) {
      ctx.save();
      ctx.globalAlpha = fadeState.previousAlpha;
      ctx.drawImage(previousImage, 0, 0, canvasSize, canvasSize);
      ctx.restore();
    }

    // Draw current glyph
    if (currentImage) {
      ctx.save();
      ctx.globalAlpha = fadeState.isComplete ? 1 : fadeState.currentAlpha;
      ctx.drawImage(currentImage, 0, 0, canvasSize, canvasSize);
      ctx.restore();
    }

    // Clear previous glyph reference when fade completes
    if (fadeState.isComplete && previousImage) {
      this.imageLoader.clearPreviousGlyphImage();
    }
  }

  async captureFrame(): Promise<ImageBitmap> {
    return this.appManager.captureFrame();
  }

  getCanvas(): HTMLCanvasElement | null {
    return this.appManager.getCanvas();
  }

  getBluePropDimensions(): { width: number; height: number } {
    return this.imageLoader.getBluePropDimensions();
  }

  getRedPropDimensions(): { width: number; height: number } {
    return this.imageLoader.getRedPropDimensions();
  }

  destroy(): void {
    this.fadeManager.reset();
    this.gridFadeManager.reset();
    this.propsFadeManager.reset();
    this.bluePropFadeManager.reset();
    this.redPropFadeManager.reset();
    this.trailsFadeManager.reset();
    this.bluePropMorphFadeManager.reset();
    this.redPropMorphFadeManager.reset();
    this.imageLoader.destroy();
    this.appManager.destroy();
    this.tintedGridCanvas = null;
    this.tintedGridImageRef = null;
  }
}
