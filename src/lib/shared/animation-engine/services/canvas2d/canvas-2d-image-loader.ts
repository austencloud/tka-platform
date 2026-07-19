import {
  generateBluePropSvg,
  generateRedPropSvg,
  generatePropSvg,
  generateGridSvg,
} from "$lib/shared/animation-engine/services/svg-generator";

/**
 * Canvas2D Image Loader
 *
 * Handles SVG-to-HTMLImageElement conversion and caching:
 * - Prop image loading
 * - Grid image loading
 * - Glyph image loading
 * - Memory-safe image lifecycle
 *
 * Single Responsibility: Image loading and management
 */

const VIEWBOX_SIZE = 950;

export class Canvas2DImageLoader {
  // Image cache
  private bluePropImage: HTMLImageElement | null = null;
  private redPropImage: HTMLImageElement | null = null;
  private gridImage: HTMLImageElement | null = null;
  private glyphImage: HTMLImageElement | null = null;
  private previousGlyphImage: HTMLImageElement | null = null;
  // Retained on every per-color prop load (mirrors previousGlyphImage), so the
  // renderer always has the pre-swap sprite available for a morph crossfade.
  // Stashing here does not itself start a fade — prop-type-manager decides
  // that, at the hot-swap sites only, so a dark-mode-only reload or the
  // initial load never trigger one even though a "previous" image exists.
  private previousBluePropImage: HTMLImageElement | null = null;
  private previousRedPropImage: HTMLImageElement | null = null;

  // Additional tunnel layer prop images (lazily populated)
  private additionalLayerImages: Array<{
    blue: HTMLImageElement | null;
    red: HTMLImageElement | null;
  }> = [];

  // Per-layer intrinsic prop dimensions (from each layer's SVG viewBox). A
  // performer wearing a different-shaped prop (sword vs staff) must draw at its
  // OWN dimensions, not the base pair's, or the sprite stretches. Index-aligned
  // with additionalLayerImages.
  private additionalLayerDimensions: Array<{
    blue: { width: number; height: number };
    red: { width: number; height: number };
  }> = [];

  // Track prop dimensions (from SVG viewBox)
  private bluePropDimensions: { width: number; height: number } = {
    width: 0,
    height: 0,
  };
  private redPropDimensions: { width: number; height: number } = {
    width: 0,
    height: 0,
  };

  async loadPropImages(propType: string): Promise<{
    blue: HTMLImageElement;
    red: HTMLImageElement;
  }> {
    try {
      // Generate blue and red prop SVGs
      const [bluePropData, redPropData] = await Promise.all([
        generateBluePropSvg(propType),
        generateRedPropSvg(propType),
      ]);

      // Create new images BEFORE releasing old ones
      const [newBlueImage, newRedImage] = await Promise.all([
        this.createImageFromSVG(
          bluePropData.svg,
          bluePropData.width,
          bluePropData.height
        ),
        this.createImageFromSVG(
          redPropData.svg,
          redPropData.width,
          redPropData.height
        ),
      ]);

      // Store dimensions
      this.bluePropDimensions = {
        width: bluePropData.width,
        height: bluePropData.height,
      };
      this.redPropDimensions = {
        width: redPropData.width,
        height: redPropData.height,
      };

      // Swap references (old images will be garbage collected)
      this.bluePropImage = newBlueImage;
      this.redPropImage = newRedImage;

      return {
        blue: this.bluePropImage,
        red: this.redPropImage,
      };
    } catch (error) {
      console.error("[Canvas2DImageLoader] Failed to load prop images:", error);
      throw error;
    }
  }

  async loadPerColorPropImages(
    bluePropType: string,
    redPropType: string,
    darkMode?: boolean
  ): Promise<{
    blue: HTMLImageElement;
    red: HTMLImageElement;
  }> {
    try {
      // Generate blue and red prop SVGs with different types
      // Pass darkMode to use local preview state instead of global
      const [bluePropData, redPropData] = await Promise.all([
        generateBluePropSvg(bluePropType, darkMode),
        generateRedPropSvg(redPropType, darkMode),
      ]);

      // Create new images
      const [newBlueImage, newRedImage] = await Promise.all([
        this.createImageFromSVG(
          bluePropData.svg,
          bluePropData.width,
          bluePropData.height
        ),
        this.createImageFromSVG(
          redPropData.svg,
          redPropData.width,
          redPropData.height
        ),
      ]);

      // Store dimensions
      this.bluePropDimensions = {
        width: bluePropData.width,
        height: bluePropData.height,
      };
      this.redPropDimensions = {
        width: redPropData.width,
        height: redPropData.height,
      };

      // Save the pre-swap sprites for a morph crossfade (see field comment).
      this.previousBluePropImage = this.bluePropImage;
      this.previousRedPropImage = this.redPropImage;

      // Swap references
      this.bluePropImage = newBlueImage;
      this.redPropImage = newRedImage;

      return {
        blue: this.bluePropImage,
        red: this.redPropImage,
      };
    } catch (error) {
      console.error(
        "[Canvas2DImageLoader] Failed to load per-color prop images:",
        error
      );
      throw error;
    }
  }

  async loadAdditionalLayerPropImages(
    layerIndex: number,
    bluePropType: string,
    redPropType: string,
    blueColor: string,
    redColor: string
  ): Promise<{
    blue: HTMLImageElement;
    red: HTMLImageElement;
  }> {
    try {
      // Generate per-hand prop SVGs with custom colors for this layer. Blue and
      // red can be different prop types (each performer's per-hand prop).
      const [bluePropData, redPropData] = await Promise.all([
        generatePropSvg(bluePropType, blueColor),
        generatePropSvg(redPropType, redColor),
      ]);

      // Create new images
      const [newBlueImage, newRedImage] = await Promise.all([
        this.createImageFromSVG(
          bluePropData.svg,
          bluePropData.width,
          bluePropData.height
        ),
        this.createImageFromSVG(
          redPropData.svg,
          redPropData.width,
          redPropData.height
        ),
      ]);

      // Ensure arrays are large enough (images + dimensions stay index-aligned)
      while (this.additionalLayerImages.length <= layerIndex) {
        this.additionalLayerImages.push({ blue: null, red: null });
      }
      while (this.additionalLayerDimensions.length <= layerIndex) {
        this.additionalLayerDimensions.push({
          blue: { width: 0, height: 0 },
          red: { width: 0, height: 0 },
        });
      }

      // Swap references
      this.additionalLayerImages[layerIndex] = {
        blue: newBlueImage,
        red: newRedImage,
      };
      this.additionalLayerDimensions[layerIndex] = {
        blue: { width: bluePropData.width, height: bluePropData.height },
        red: { width: redPropData.width, height: redPropData.height },
      };

      return { blue: newBlueImage, red: newRedImage };
    } catch (error) {
      console.error(
        `[Canvas2DImageLoader] Failed to load additional layer ${layerIndex} prop images:`,
        error
      );
      throw error;
    }
  }

  async loadGridImage(
    gridMode: string,
    canvasSize: number,
    showNonRadialPoints: boolean = true
  ): Promise<HTMLImageElement> {
    try {
      const { GridMode } =
        await import("$lib/shared/pictograph/grid/domain/enums/grid-enums");

      // Convert gridMode string to GridMode enum
      // "8point" needs special handling since "8POINT" isn't a valid enum key
      let gridModeEnum: (typeof GridMode)[keyof typeof GridMode];
      if (gridMode === "8point") {
        gridModeEnum = GridMode.EIGHT_POINT;
      } else {
        gridModeEnum =
          GridMode[gridMode.toUpperCase() as keyof typeof GridMode] ||
          GridMode.DIAMOND;
      }

      const gridSvg = await generateGridSvg(gridModeEnum, true, showNonRadialPoints);

      // Create new image
      const newImage = await this.createImageFromSVG(
        gridSvg,
        canvasSize,
        canvasSize
      );

      // Swap reference
      this.gridImage = newImage;

      return this.gridImage;
    } catch (error) {
      console.error("[Canvas2DImageLoader] Failed to load grid image:", error);
      throw error;
    }
  }

  async loadGlyphImage(
    svgString: string,
    _width: number,
    _height: number
  ): Promise<{
    current: HTMLImageElement;
    previous: HTMLImageElement | null;
  }> {
    try {
      // CRITICAL: Clear old previousGlyphImage reference
      // HTMLImageElements don't need explicit destroy, but clearing ref allows GC
      this.previousGlyphImage = null;

      // Save previous glyph for fade transition
      if (this.glyphImage) {
        this.previousGlyphImage = this.glyphImage;
      }

      // Create image from SVG (full 950x950 viewBox)
      this.glyphImage = await this.createImageFromSVG(
        svgString,
        VIEWBOX_SIZE,
        VIEWBOX_SIZE
      );

      return {
        current: this.glyphImage,
        previous: this.previousGlyphImage,
      };
    } catch (error) {
      console.error("[Canvas2DImageLoader] Failed to load glyph image:", error);
      throw error;
    }
  }

  /**
   * Convert SVG string to HTMLImageElement
   * Uses data URL approach for reliable cross-browser support
   */
  private async createImageFromSVG(
    svgString: string,
    width: number,
    height: number
  ): Promise<HTMLImageElement> {
    // Convert SVG to data URL
    const base64 = btoa(unescape(encodeURIComponent(svgString)));
    const dataUrl = `data:image/svg+xml;base64,${base64}`;

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.width = width;
      img.height = height;

      img.onload = () => {
        // Clean up handlers
        img.onload = null;
        img.onerror = null;
        resolve(img);
      };

      img.onerror = () => {
        // Clean up handlers
        img.onload = null;
        img.onerror = null;
        console.error("[Canvas2DImageLoader] Image load error");
        reject(new Error("Failed to load SVG image"));
      };

      img.src = dataUrl;
    });
  }

  // Getters
  getBluePropImage(): HTMLImageElement | null {
    return this.bluePropImage;
  }

  getRedPropImage(): HTMLImageElement | null {
    return this.redPropImage;
  }

  getPreviousBluePropImage(): HTMLImageElement | null {
    return this.previousBluePropImage;
  }

  getPreviousRedPropImage(): HTMLImageElement | null {
    return this.previousRedPropImage;
  }

  getAdditionalLayerImages(layerIndex: number): {
    blue: HTMLImageElement | null;
    red: HTMLImageElement | null;
  } {
    if (layerIndex < this.additionalLayerImages.length) {
      return this.additionalLayerImages[layerIndex]!;
    }
    return { blue: null, red: null };
  }

  /** Intrinsic per-hand dimensions of an additional layer's props, or null when
   *  that layer hasn't loaded yet (caller falls back to the base dimensions). */
  getAdditionalLayerDimensions(layerIndex: number): {
    blue: { width: number; height: number };
    red: { width: number; height: number };
  } | null {
    return this.additionalLayerDimensions[layerIndex] ?? null;
  }

  getGridImage(): HTMLImageElement | null {
    return this.gridImage;
  }

  getGlyphImage(): HTMLImageElement | null {
    return this.glyphImage;
  }

  getPreviousGlyphImage(): HTMLImageElement | null {
    return this.previousGlyphImage;
  }

  getBluePropDimensions(): { width: number; height: number } {
    return this.bluePropDimensions;
  }

  getRedPropDimensions(): { width: number; height: number } {
    return this.redPropDimensions;
  }

  clearPreviousGlyphImage(): void {
    this.previousGlyphImage = null;
  }

  clearPreviousBluePropImage(): void {
    this.previousBluePropImage = null;
  }

  clearPreviousRedPropImage(): void {
    this.previousRedPropImage = null;
  }

  destroy(): void {
    // Clear all image references (allows garbage collection)
    this.bluePropImage = null;
    this.redPropImage = null;
    this.previousBluePropImage = null;
    this.previousRedPropImage = null;
    this.additionalLayerImages.length = 0;
    this.additionalLayerDimensions.length = 0;
    this.gridImage = null;
    this.glyphImage = null;
    this.previousGlyphImage = null;
  }
}
