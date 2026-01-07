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
 * - Canvas2DArmRenderer: Stick-figure arm rendering with 2D IK
 * - Canvas2DFadeManager: Glyph fade transitions
 */

import { injectable } from "inversify";
import type {
  IAnimationRenderer,
  RenderSceneParams,
} from "../contracts/IAnimationRenderer";
import { Canvas2DApplicationManager } from "./canvas2d/Canvas2DApplicationManager";
import { Canvas2DImageLoader } from "./canvas2d/Canvas2DImageLoader";
import { Canvas2DTrailRenderer } from "./canvas2d/Canvas2DTrailRenderer";
import { Canvas2DArmRenderer } from "./canvas2d/Canvas2DArmRenderer";
import { Canvas2DFadeManager } from "./canvas2d/Canvas2DFadeManager";
import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";

// Constants matching AnimatorCanvas EXACTLY
const VIEWBOX_SIZE = 950;
const GRID_HALFWAY_POINT_OFFSET = 150; // Strict hand points (animation mode)
const INWARD_FACTOR = 1.0; // No inward adjustment - use exact grid coordinates

@injectable()
export class Canvas2DAnimationRenderer implements IAnimationRenderer {
  // Specialized service managers
  private appManager: Canvas2DApplicationManager;
  private imageLoader: Canvas2DImageLoader;
  private trailRenderer: Canvas2DTrailRenderer;
  private armRenderer: Canvas2DArmRenderer;
  private fadeManager: Canvas2DFadeManager;

  // Track current grid mode for resize operations
  private currentGridMode: string = "diamond";

  constructor() {
    this.appManager = new Canvas2DApplicationManager();
    this.imageLoader = new Canvas2DImageLoader();
    this.trailRenderer = new Canvas2DTrailRenderer();
    this.armRenderer = new Canvas2DArmRenderer();
    this.fadeManager = new Canvas2DFadeManager();
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
   * Check if background is currently transitioning
   * Used by render loop to continue rendering during smooth color transitions
   */
  isBackgroundTransitioning(): boolean {
    return this.appManager.isBackgroundTransitioning();
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

    // 2. Draw grid (if visible)
    const gridImage = this.imageLoader.getGridImage();
    if (params.visibility.gridVisible && gridImage) {
      // In Dark Mode, invert the grid colors so black points become off-white
      const isDarkMode = this.appManager.isDarkModeEnabled();
      if (isDarkMode) {
        ctx.filter = "invert(0.85)"; // Invert to off-white (not pure white)
      }
      ctx.drawImage(gridImage, 0, 0, canvasSize, canvasSize);
      if (isDarkMode) {
        ctx.filter = "none";
      }
    }

    // 3. Draw trails (if visible)
    if (params.visibility.trailsVisible) {
      this.trailRenderer.renderTrails(
        ctx,
        params.blueTrailPoints,
        params.redTrailPoints,
        params.trailSettings,
        params.currentTime,
        !!params.blueProp && params.visibility.blueMotionVisible,
        !!params.redProp && params.visibility.redMotionVisible
      );
    }

    // 3.5. Draw arms (if visible) - render BEFORE props so arms appear behind
    if (params.visibility.armsVisible) {
      const blueTransform = params.blueProp
        ? this.calculatePropTransform(
            params.blueProp,
            params.bluePropDimensions,
            canvasSize
          )
        : null;
      const redTransform = params.redProp
        ? this.calculatePropTransform(
            params.redProp,
            params.redPropDimensions,
            canvasSize
          )
        : null;

      const colors = getAnimationVisibilityManager().getMotionColors();

      this.armRenderer.renderArms(
        ctx,
        blueTransform?.x ?? canvasSize / 2,
        blueTransform?.y ?? canvasSize / 2,
        redTransform?.x ?? canvasSize / 2,
        redTransform?.y ?? canvasSize / 2,
        canvasSize,
        colors.blue,
        colors.red,
        !!params.blueProp && params.visibility.blueMotionVisible,
        !!params.redProp && params.visibility.redMotionVisible
      );
    }

    // 4. Draw props (if visible and not hidden by trail settings)
    if (params.visibility.propsVisible && !params.trailSettings.hideProps) {
      // Primary blue prop
      if (params.blueProp && params.visibility.blueMotionVisible) {
        this.renderProp(
          ctx,
          params.blueProp,
          this.imageLoader.getBluePropImage(),
          params.bluePropDimensions,
          canvasSize,
          params.bluePropFlipped ?? false
        );
      }

      // Primary red prop
      if (params.redProp && params.visibility.redMotionVisible) {
        this.renderProp(
          ctx,
          params.redProp,
          this.imageLoader.getRedPropImage(),
          params.redPropDimensions,
          canvasSize,
          params.redPropFlipped ?? false
        );
      }

      // Secondary blue prop (tunnel mode)
      if (params.secondaryBlueProp && params.visibility.blueMotionVisible) {
        this.renderProp(
          ctx,
          params.secondaryBlueProp,
          this.imageLoader.getSecondaryBluePropImage(),
          params.bluePropDimensions,
          canvasSize,
          params.bluePropFlipped ?? false
        );
      }

      // Secondary red prop (tunnel mode)
      if (params.secondaryRedProp && params.visibility.redMotionVisible) {
        this.renderProp(
          ctx,
          params.secondaryRedProp,
          this.imageLoader.getSecondaryRedPropImage(),
          params.redPropDimensions,
          canvasSize,
          params.redPropFlipped ?? false
        );
      }
    }

    // 5. Draw glyph (with fade transition)
    this.renderGlyph(ctx, params.currentTime, canvasSize);
  }

  /**
   * Render a prop at its calculated position with rotation
   * @param flipped - Whether to mirror the prop horizontally (for asymmetric props like Buugeng)
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
    flipped: boolean = false
  ): void {
    if (!image) return;

    const transform = this.calculatePropTransform(
      propState,
      dimensions,
      canvasSize
    );

    ctx.save();
    ctx.translate(transform.x, transform.y);
    ctx.rotate(transform.rotation);

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
    this.imageLoader.destroy();
    this.appManager.destroy();
  }
}
