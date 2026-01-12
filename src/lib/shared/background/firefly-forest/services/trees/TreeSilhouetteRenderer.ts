/**
 * Tree Silhouette Renderer
 *
 * Handles image-based tree rendering with depth-based atmospheric
 * perspective (tinting) and rim light effects.
 */

import type { TreeType, RGB, TreeColors } from "../../domain/models/tree-silhouette-models";
import type { TreeCategory, TreeSilhouetteImageLoader } from "../TreeSilhouetteImageLoader";
import {
  NUM_LAYERS,
  FAR_SILHOUETTE,
  NEAR_SILHOUETTE,
  RIM_LIGHT,
} from "../../domain/constants/tree-silhouette-constants";

type RenderContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export interface ITreeSilhouetteRenderer {
  /** Preload tree silhouette images */
  preloadImages(): Promise<void>;

  /** Check if images are loaded */
  areImagesLoaded(): boolean;

  /** Clear the used images tracker for a fresh scene */
  clearUsedImages(): void;

  /**
   * Draw a tree using a pre-loaded silhouette image.
   * Applies depth-based tinting for atmospheric perspective.
   * @returns The filename of the image used (for tracking), or null if no image available
   */
  drawTreeImage(
    ctx: RenderContext,
    x: number,
    baseY: number,
    width: number,
    height: number,
    treeType: TreeType,
    layer: number,
    seed: number
  ): string | null;

  /** Get silhouette color for a tree based on its layer depth */
  getTreeColors(layer: number): TreeColors;

  /**
   * Get the ground/base Y position for a given layer.
   * Far trees sit BELOW the visible horizon.
   * Near trees extend below the viewport.
   */
  getLayerBaseY(layer: number, canvasHeight: number): number;
}

export function createTreeSilhouetteRenderer(
  imageLoader: TreeSilhouetteImageLoader
): ITreeSilhouetteRenderer {
  let imagesLoaded = false;
  let usedImages: Set<string> = new Set();

  // ===================
  // COLOR UTILITIES
  // ===================

  function lerpColor(c1: RGB, c2: RGB, t: number): RGB {
    return {
      r: Math.floor(c1.r + (c2.r - c1.r) * t),
      g: Math.floor(c1.g + (c2.g - c1.g) * t),
      b: Math.floor(c1.b + (c2.b - c1.b) * t),
    };
  }

  function rgbToString(color: RGB, alpha = 1): string {
    if (alpha < 1) {
      return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
    }
    return `rgb(${color.r}, ${color.g}, ${color.b})`;
  }

  // ===================
  // PUBLIC API
  // ===================

  async function preloadImages(): Promise<void> {
    await imageLoader.preload();
    imagesLoaded = true;
  }

  function areImagesLoaded(): boolean {
    return imagesLoaded;
  }

  function clearUsedImages(): void {
    usedImages.clear();
  }

  function getTreeColors(layer: number): TreeColors {
    // Interpolate based on layer position (0 = farthest, NUM_LAYERS-1 = nearest)
    const t = layer / (NUM_LAYERS - 1);
    // Ease-out curve: trees get dark quickly, only far layers stay light
    // t^0.4 makes mid-layers much darker while preserving the far->near gradient
    const easedT = Math.pow(t, 0.4);
    return {
      silhouette: lerpColor(FAR_SILHOUETTE, NEAR_SILHOUETTE, easedT),
    };
  }

  function getLayerBaseY(layer: number, canvasHeight: number): number {
    // Far trees (layer 0): base at ~82% down (below horizon at 78%, so they stand on ground)
    // Near trees (layer 6): base at 101% (extends below viewport)
    const farBaseRatio = 0.82;
    const nearBaseRatio = 1.01;

    const t = layer / (NUM_LAYERS - 1);
    // Ease-out curve so the depth effect is more pronounced for far layers
    const easedT = 1 - Math.pow(1 - t, 1.5);
    const baseRatio = farBaseRatio + (nearBaseRatio - farBaseRatio) * easedT;

    return canvasHeight * baseRatio;
  }

  function drawTreeImage(
    ctx: RenderContext,
    x: number,
    baseY: number,
    width: number,
    height: number,
    treeType: TreeType,
    layer: number,
    seed: number
  ): string | null {
    // Use unique selector to prevent duplicate trees in the same scene
    const treeImage = imageLoader.getUniqueFromCategory(
      treeType as TreeCategory,
      usedImages,
      seed
    );
    if (!treeImage) return null;

    // Track this image as used
    usedImages.add(treeImage.filename);

    // Calculate draw dimensions maintaining aspect ratio
    const targetHeight = height;
    const targetWidth = targetHeight * treeImage.aspectRatio;

    // Position: center horizontally at x, bottom at baseY
    const drawX = x - targetWidth / 2;
    const drawY = baseY - targetHeight;

    // Get depth-based color
    const colors = getTreeColors(layer);

    // Create a temporary canvas for tinting
    const tempCanvas = new OffscreenCanvas(
      Math.ceil(targetWidth),
      Math.ceil(targetHeight)
    );
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) return null;

    // Draw the silhouette scaled
    tempCtx.drawImage(
      treeImage.canvas as CanvasImageSource,
      0,
      0,
      treeImage.width,
      treeImage.height,
      0,
      0,
      targetWidth,
      targetHeight
    );

    // Apply darkness-based tint using composite operation
    // Far trees get lifted by atmospheric haze, near trees stay pure black
    tempCtx.globalCompositeOperation = "source-atop";
    tempCtx.fillStyle = rgbToString(colors.silhouette);
    tempCtx.fillRect(0, 0, targetWidth, targetHeight);

    // Draw to main canvas
    ctx.drawImage(tempCanvas as CanvasImageSource, drawX, drawY);

    // Apply rim light effect
    // For images, we draw a subtle glow behind
    const t = layer / (NUM_LAYERS - 1);
    const rimOpacity = 0.15 + t * 0.2;
    ctx.globalCompositeOperation = "destination-over";
    ctx.shadowColor = rgbToString(RIM_LIGHT, rimOpacity);
    ctx.shadowBlur = 2 + t * 3;
    ctx.drawImage(tempCanvas as CanvasImageSource, drawX, drawY);
    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = "source-over";

    return treeImage.filename;
  }

  return {
    preloadImages,
    areImagesLoaded,
    clearUsedImages,
    drawTreeImage,
    getTreeColors,
    getLayerBaseY,
  };
}
