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

import type { RenderedPropTransform } from "$lib/shared/animation-engine/domain/types/FireTypes";
import type {
} from "$lib/shared/animation-engine/domain/types/TrailTypes";
import type {
  RenderSceneParams,
} from "$lib/shared/animation-engine/domain/types/AnimationRenderTypes";

export type {
  AdditionalLayerRenderData,
  AnimationVisibilitySettings,
  RenderSceneParams,
} from "$lib/shared/animation-engine/domain/types/AnimationRenderTypes";
import { Canvas2DApplicationManager } from "$lib/shared/animation-engine/services/canvas2d/canvas-2d-application-manager";
import { Canvas2DImageLoader } from "$lib/shared/animation-engine/services/canvas2d/canvas-2d-image-loader";
import { Canvas2DTrailRenderer } from "$lib/shared/animation-engine/services/canvas2d/canvas-2d-trail-renderer";
import { Canvas2DFadeManager } from "$lib/shared/animation-engine/services/canvas2d/canvas-2d-fade-manager";
import { Canvas2DGridFadeManager } from "$lib/shared/animation-engine/services/canvas2d/canvas-2d-grid-fade-manager";
import { Canvas2DVisibilityFadeManager } from "./canvas2d/canvas-2d-visibility-fade-manager";

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

  // Cached inverted glyph copies for dark mode. The bottom-left glyph is drawn
  // from a serialized SVG whose dark-mode inversion came from an SVG filter that
  // iOS Safari drops when the SVG is rasterized as an <img>, leaving the glyph
  // black (invisible). We invert per-pixel on an offscreen canvas instead
  // (replicates invert(0.85), preserves any colored sub-glyph elements). Keyed
  // by source image; rebuilt only when the glyph image or size changes.
  private invertedGlyphCache = new Map<
    HTMLImageElement,
    { canvas: HTMLCanvasElement; size: number }
  >();

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

  /**
   * Return an off-white tinted copy of a glyph image for dark mode.
   *
   * The glyph's dark-mode inversion normally came from an SVG filter, which iOS
   * Safari ignores when the SVG is rasterized as an <img> (glyph stayed black /
   * invisible). We recolor on an offscreen canvas with "source-in" — the SAME
   * compositing the grid uses, which is confirmed working on iPhone. We do NOT
   * use getImageData here: on iOS, drawing an SVG data-URL image taints the
   * canvas, so getImageData throws a SecurityError and the glyph draw aborts.
   * #d9d9d9 matches the grid and the old invert(0.85). The glyph is black
   * line-art, so flattening reads the same as inverting. Cached per source
   * image; rebuilt only when the image or size change.
   */
  private getTintedGlyph(
    image: HTMLImageElement,
    canvasSize: number
  ): HTMLCanvasElement | null {
    const cached = this.invertedGlyphCache.get(image);
    if (cached && cached.size === canvasSize) {
      return cached.canvas;
    }

    const offscreen = cached?.canvas ?? document.createElement("canvas");
    offscreen.width = canvasSize;
    offscreen.height = canvasSize;
    const offCtx = offscreen.getContext("2d");
    if (!offCtx) return null;

    offCtx.clearRect(0, 0, canvasSize, canvasSize);
    // 1. Draw the glyph (black ink) as an alpha mask.
    offCtx.drawImage(image, 0, 0, canvasSize, canvasSize);
    // 2. Recolor only the drawn pixels to off-white.
    offCtx.globalCompositeOperation = "source-in";
    offCtx.fillStyle = "#d9d9d9";
    offCtx.fillRect(0, 0, canvasSize, canvasSize);
    offCtx.globalCompositeOperation = "source-over";

    // Bound the cache (current + previous glyph during a crossfade + slack).
    if (this.invertedGlyphCache.size > 8) {
      const oldest = this.invertedGlyphCache.keys().next().value;
      if (oldest !== undefined) this.invertedGlyphCache.delete(oldest);
    }
    this.invertedGlyphCache.set(image, { canvas: offscreen, size: canvasSize });
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

  async loadAdditionalLayerPropTextures(
    layerIndex: number,
    propType: string,
    blueColor: string,
    redColor: string
  ): Promise<void> {
    await this.imageLoader.loadAdditionalLayerPropImages(
      layerIndex,
      propType,
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
      this.trailsFadeManager.isTransitionInProgress()
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
    if (blueAlpha > 0 && params.blueProp) {
      ctx.save();
      ctx.globalAlpha = blueAlpha;

      // Primary blue prop
      const bluePropImage = this.imageLoader.getBluePropImage();
      if (bluePropImage) {
        const blueTransform = this.calculatePropTransform(params.blueProp, params.bluePropDimensions, canvasSize);
        this.lastBlueTransform = {
          centerX: blueTransform.x,
          centerY: blueTransform.y,
          angle: params.bluePropType?.toLowerCase() === "hand" ? 0 : blueTransform.rotation,
          scaleFactor: gridScaleFactor,
        };
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

      // Screen-space sphere shading (stays fixed as prop rotates)
      if (params.bluePropType) {
        this.renderSphereShading(ctx, params.blueProp, params.bluePropDimensions, canvasSize, params.bluePropType);
      }

      // Additional tunnel layer blue props
      if (params.additionalLayers) {
        for (let i = 0; i < params.additionalLayers.length; i++) {
          const layer = params.additionalLayers[i]!;
          if (layer.blueProp && layer.hasBlue) {
            const layerImages = this.imageLoader.getAdditionalLayerImages(i);
            if (layerImages.blue) {
              this.renderProp(
                ctx,
                layer.blueProp,
                layerImages.blue,
                params.bluePropDimensions,
                canvasSize,
                params.bluePropFlipped ?? false,
                params.bluePropType
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
      ctx.globalAlpha = redAlpha;

      // Primary red prop
      const redPropImage = this.imageLoader.getRedPropImage();
      if (redPropImage) {
        const redTransform = this.calculatePropTransform(params.redProp, params.redPropDimensions, canvasSize);
        this.lastRedTransform = {
          centerX: redTransform.x,
          centerY: redTransform.y,
          angle: params.redPropType?.toLowerCase() === "hand" ? 0 : redTransform.rotation,
          scaleFactor: gridScaleFactor,
        };
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

      // Screen-space sphere shading (stays fixed as prop rotates)
      if (params.redPropType) {
        this.renderSphereShading(ctx, params.redProp, params.redPropDimensions, canvasSize, params.redPropType);
      }

      // Additional tunnel layer red props
      if (params.additionalLayers) {
        for (let i = 0; i < params.additionalLayers.length; i++) {
          const layer = params.additionalLayers[i]!;
          if (layer.redProp && layer.hasRed) {
            const layerImages = this.imageLoader.getAdditionalLayerImages(i);
            if (layerImages.red) {
              this.renderProp(
                ctx,
                layer.redProp,
                layerImages.red,
                params.redPropDimensions,
                canvasSize,
                params.redPropFlipped ?? false,
                params.redPropType
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

  /**
   * Render a prop at its calculated position with rotation
   * @param flipped - Whether to mirror the prop horizontally (for asymmetric props like Buugeng)
   * @param propType - The type of prop being rendered (used for prop-specific rules like hands never rotating)
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
    propType?: string
  ): void {
    if (!image) return;

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

    ctx.drawImage(
      image,
      -transform.width / 2,
      -transform.height / 2,
      transform.width,
      transform.height
    );

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

    // In dark mode draw a per-pixel-inverted copy (iOS ignores the glyph's SVG
    // invert filter when rasterized, leaving it black/invisible on the dark canvas).
    const isDarkMode = this.appManager.isDarkModeEnabled();

    // Draw previous glyph (fading out)
    if (previousImage && !fadeState.isComplete) {
      const img = isDarkMode
        ? (this.getTintedGlyph(previousImage, canvasSize) ?? previousImage)
        : previousImage;
      ctx.save();
      ctx.globalAlpha = fadeState.previousAlpha;
      ctx.drawImage(img, 0, 0, canvasSize, canvasSize);
      ctx.restore();
    }

    // Draw current glyph
    if (currentImage) {
      const img = isDarkMode
        ? (this.getTintedGlyph(currentImage, canvasSize) ?? currentImage)
        : currentImage;
      ctx.save();
      ctx.globalAlpha = fadeState.isComplete ? 1 : fadeState.currentAlpha;
      ctx.drawImage(img, 0, 0, canvasSize, canvasSize);
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
    this.imageLoader.destroy();
    this.appManager.destroy();
    this.invertedGlyphCache.clear();
    this.tintedGridCanvas = null;
    this.tintedGridImageRef = null;
  }
}
