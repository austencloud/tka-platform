/**
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

import type {
  IAnimationRenderer,
  RenderSceneParams,
} from "../contracts/IAnimationRenderer";
import { Canvas2DApplicationManager } from "./canvas2d/Canvas2DApplicationManager";
import { Canvas2DImageLoader } from "./canvas2d/Canvas2DImageLoader";
import { Canvas2DTrailRenderer } from "./canvas2d/Canvas2DTrailRenderer";
import { Canvas2DFadeManager } from "./canvas2d/Canvas2DFadeManager";
import { Canvas2DGridFadeManager } from "./canvas2d/Canvas2DGridFadeManager";
import { Canvas2DVisibilityFadeManager } from "./canvas2d/Canvas2DVisibilityFadeManager";

// Constants matching AnimatorCanvas EXACTLY
const VIEWBOX_SIZE = 950;
const GRID_HALFWAY_POINT_OFFSET = 150; // Strict hand points (animation mode)
const INWARD_FACTOR = 1.0; // No inward adjustment - use exact grid coordinates

export class Canvas2DAnimationRenderer implements IAnimationRenderer {
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

  // Track current grid mode for resize operations
  private currentGridMode: string = "diamond";

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

  async initialize(
    container: HTMLElement,
    size: number,
    backgroundAlpha: number = 1
  ): Promise<void> {
    await this.appManager.initialize(container, size, backgroundAlpha);
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

  async loadSecondaryPropTextures(
    propType: string,
    blueColor: string,
    redColor: string
  ): Promise<void> {
    await this.imageLoader.loadSecondaryPropImages(
      propType,
      blueColor,
      redColor
    );
  }

  async loadGridTexture(gridMode: string): Promise<void> {
    this.currentGridMode = gridMode;
    const canvasSize = this.appManager.getCurrentSize();
    await this.imageLoader.loadGridImage(gridMode, canvasSize);
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

      // In Dark Mode, invert the grid colors so black points become off-white
      const isDarkMode = this.appManager.isDarkModeEnabled();
      if (isDarkMode) {
        ctx.filter = "invert(0.85)"; // Invert to off-white (not pure white)
      }
      ctx.drawImage(gridImage, 0, 0, canvasSize, canvasSize);
      ctx.restore();
    }

    // 3. Draw trails (with fade transition for toggle)
    this.trailsFadeManager.setVisible(params.visibility.trailsVisible);
    const trailsFadeState = this.trailsFadeManager.updateProgress(
      params.currentTime
    );

    if (trailsFadeState.alpha > 0) {
      ctx.save();
      ctx.globalAlpha = trailsFadeState.alpha;
      this.trailRenderer.renderTrails(
        ctx,
        params.blueTrailPoints,
        params.redTrailPoints,
        params.trailSettings,
        params.currentTime,
        !!params.blueProp && params.visibility.blueMotionVisible,
        !!params.redProp && params.visibility.redMotionVisible
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
      this.renderProp(
        ctx,
        params.blueProp,
        this.imageLoader.getBluePropImage(),
        params.bluePropDimensions,
        canvasSize,
        params.bluePropFlipped ?? false,
        params.bluePropType
      );

      // Secondary blue prop (tunnel mode)
      if (params.secondaryBlueProp) {
        this.renderProp(
          ctx,
          params.secondaryBlueProp,
          this.imageLoader.getSecondaryBluePropImage(),
          params.bluePropDimensions,
          canvasSize,
          params.bluePropFlipped ?? false,
          params.bluePropType
        );
      }

      ctx.restore();
    }

    // Red props: render if either fade has alpha > 0
    const redAlpha = propsFadeState.alpha * redFadeState.alpha;
    if (redAlpha > 0 && params.redProp) {
      ctx.save();
      ctx.globalAlpha = redAlpha;

      // Primary red prop
      this.renderProp(
        ctx,
        params.redProp,
        this.imageLoader.getRedPropImage(),
        params.redPropDimensions,
        canvasSize,
        params.redPropFlipped ?? false,
        params.redPropType
      );

      // Secondary red prop (tunnel mode)
      if (params.secondaryRedProp) {
        this.renderProp(
          ctx,
          params.secondaryRedProp,
          this.imageLoader.getSecondaryRedPropImage(),
          params.redPropDimensions,
          canvasSize,
          params.redPropFlipped ?? false,
          params.redPropType
        );
      }

      ctx.restore();
    }

    // 5. Draw glyph (with fade transition)
    this.renderGlyph(ctx, params.currentTime, canvasSize);
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
    this.imageLoader.destroy();
    this.appManager.destroy();
  }
}
