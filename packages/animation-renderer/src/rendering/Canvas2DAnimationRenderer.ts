/**
 * Canvas2D Animation Renderer Implementation
 *
 * Pure Canvas2D renderer for animation visualization.
 * Zero external dependencies. No WebGL context management issues.
 *
 * This class delegates to specialized services following SRP:
 * - Canvas2DApplicationManager: Canvas lifecycle and management
 * - Canvas2DImageLoader: SVG->Image conversion and caching
 * - Canvas2DTrailRenderer: Trail rendering logic
 * - Canvas2DFadeManager: Glyph fade transitions
 * - Canvas2DGridFadeManager: Grid visibility toggle transitions
 * - Canvas2DVisibilityFadeManager: Props and trails visibility transitions
 */

import type {
  IAnimationRenderer,
  RenderSceneParams,
} from "../contracts/IAnimationRenderer";
import type { ISVGGenerator } from "../contracts/ISVGGenerator";
import { Canvas2DApplicationManager } from "./Canvas2DApplicationManager";
import { Canvas2DImageLoader } from "./Canvas2DImageLoader";
import { Canvas2DTrailRenderer } from "./Canvas2DTrailRenderer";
import { Canvas2DFadeManager } from "./Canvas2DFadeManager";
import { Canvas2DGridFadeManager } from "./Canvas2DGridFadeManager";
import { Canvas2DVisibilityFadeManager } from "./Canvas2DVisibilityFadeManager";

// Constants matching AnimatorCanvas EXACTLY
const VIEWBOX_SIZE = 950;
const GRID_HALFWAY_POINT_OFFSET = 150;
const INWARD_FACTOR = 1.0;

export class Canvas2DAnimationRenderer implements IAnimationRenderer {
  private appManager: Canvas2DApplicationManager;
  private imageLoader: Canvas2DImageLoader;
  private trailRenderer: Canvas2DTrailRenderer;
  private fadeManager: Canvas2DFadeManager;
  private gridFadeManager: Canvas2DGridFadeManager;
  private propsFadeManager: Canvas2DVisibilityFadeManager;
  private bluePropFadeManager: Canvas2DVisibilityFadeManager;
  private redPropFadeManager: Canvas2DVisibilityFadeManager;
  private trailsFadeManager: Canvas2DVisibilityFadeManager;

  private currentGridMode: string = "diamond";

  constructor(svgGenerator: ISVGGenerator) {
    this.appManager = new Canvas2DApplicationManager();
    this.imageLoader = new Canvas2DImageLoader(svgGenerator);
    this.trailRenderer = new Canvas2DTrailRenderer();
    this.fadeManager = new Canvas2DFadeManager();
    this.gridFadeManager = new Canvas2DGridFadeManager();
    this.propsFadeManager = new Canvas2DVisibilityFadeManager(300, 200);
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

  setDarkMode(enabled: boolean, animate: boolean = true): void {
    this.appManager.setDarkMode(enabled, animate);
  }

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

    if (gridFadeState.alpha > 0 && gridImage) {
      ctx.save();
      ctx.globalAlpha = gridFadeState.alpha;

      const isDarkMode = this.appManager.isDarkModeEnabled();
      if (isDarkMode) {
        ctx.filter = "invert(0.85)";
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
        !!params.redProp && params.visibility.redMotionVisible,
        params.qualityHints
      );
      ctx.restore();
    }

    // 4. Draw props (with fade transitions for toggles)
    this.propsFadeManager.setVisible(
      params.visibility.propsVisible && !params.trailSettings.hideProps
    );
    const propsFadeState = this.propsFadeManager.updateProgress(
      params.currentTime
    );

    this.bluePropFadeManager.setVisible(params.visibility.blueMotionVisible);
    this.redPropFadeManager.setVisible(params.visibility.redMotionVisible);
    const blueFadeState = this.bluePropFadeManager.updateProgress(
      params.currentTime
    );
    const redFadeState = this.redPropFadeManager.updateProgress(
      params.currentTime
    );

    // Blue props
    const blueAlpha = propsFadeState.alpha * blueFadeState.alpha;
    if (blueAlpha > 0 && params.blueProp) {
      ctx.save();
      ctx.globalAlpha = blueAlpha;

      const bluePropImage = this.imageLoader.getBluePropImage();
      if (bluePropImage) {
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

      if (params.secondaryBlueProp) {
        const secondaryBluePropImage =
          this.imageLoader.getSecondaryBluePropImage();
        if (secondaryBluePropImage) {
          this.renderProp(
            ctx,
            params.secondaryBlueProp,
            secondaryBluePropImage,
            params.bluePropDimensions,
            canvasSize,
            params.bluePropFlipped ?? false,
            params.bluePropType
          );
        }
      }

      ctx.restore();
    }

    // Red props
    const redAlpha = propsFadeState.alpha * redFadeState.alpha;
    if (redAlpha > 0 && params.redProp) {
      ctx.save();
      ctx.globalAlpha = redAlpha;

      const redPropImage = this.imageLoader.getRedPropImage();
      if (redPropImage) {
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

      if (params.secondaryRedProp) {
        const secondaryRedPropImage =
          this.imageLoader.getSecondaryRedPropImage();
        if (secondaryRedPropImage) {
          this.renderProp(
            ctx,
            params.secondaryRedProp,
            secondaryRedPropImage,
            params.redPropDimensions,
            canvasSize,
            params.redPropFlipped ?? false,
            params.redPropType
          );
        }
      }

      ctx.restore();
    }

    // 5. Draw glyph (with fade transition)
    this.renderGlyph(ctx, params.currentTime, canvasSize);
  }

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

    // Hands should never rotate
    const rotation =
      propType?.toLowerCase() === "hand" ? 0 : transform.rotation;

    ctx.save();
    ctx.translate(transform.x, transform.y);
    ctx.rotate(rotation);

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
      x = centerX + propState.x * scaledHalfwayRadius * INWARD_FACTOR;
      y = centerY + propState.y * scaledHalfwayRadius * INWARD_FACTOR;
    } else {
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

  private renderGlyph(
    ctx: CanvasRenderingContext2D,
    currentTime: number,
    canvasSize: number
  ): void {
    const currentImage = this.imageLoader.getGlyphImage();
    const previousImage = this.imageLoader.getPreviousGlyphImage();

    const fadeState = this.fadeManager.updateFadeProgress(currentTime);

    if (previousImage && !fadeState.isComplete) {
      ctx.save();
      ctx.globalAlpha = fadeState.previousAlpha;
      ctx.drawImage(previousImage, 0, 0, canvasSize, canvasSize);
      ctx.restore();
    }

    if (currentImage) {
      ctx.save();
      ctx.globalAlpha = fadeState.isComplete ? 1 : fadeState.currentAlpha;
      ctx.drawImage(currentImage, 0, 0, canvasSize, canvasSize);
      ctx.restore();
    }

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
