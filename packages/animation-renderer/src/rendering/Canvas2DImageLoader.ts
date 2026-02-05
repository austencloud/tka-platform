/**
 * Canvas2D Image Loader
 *
 * Handles SVG-to-HTMLImageElement conversion and caching:
 * - Prop image loading
 * - Grid image loading
 * - Glyph image loading
 * - Memory-safe image lifecycle
 *
 * Accepts an ISVGGenerator via constructor injection (no DI container dependency).
 */

import type { ISVGGenerator } from "../contracts/ISVGGenerator";

const VIEWBOX_SIZE = 950;

export class Canvas2DImageLoader {
  private bluePropImage: HTMLImageElement | null = null;
  private redPropImage: HTMLImageElement | null = null;
  private secondaryBluePropImage: HTMLImageElement | null = null;
  private secondaryRedPropImage: HTMLImageElement | null = null;
  private gridImage: HTMLImageElement | null = null;
  private glyphImage: HTMLImageElement | null = null;
  private previousGlyphImage: HTMLImageElement | null = null;

  private bluePropDimensions: { width: number; height: number } = {
    width: 0,
    height: 0,
  };
  private redPropDimensions: { width: number; height: number } = {
    width: 0,
    height: 0,
  };

  constructor(private readonly svgGenerator: ISVGGenerator) {}

  async loadPropImages(propType: string): Promise<{
    blue: HTMLImageElement;
    red: HTMLImageElement;
  }> {
    const [bluePropData, redPropData] = await Promise.all([
      this.svgGenerator.generateBluePropSvg(propType),
      this.svgGenerator.generateRedPropSvg(propType),
    ]);

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

    this.bluePropDimensions = {
      width: bluePropData.width,
      height: bluePropData.height,
    };
    this.redPropDimensions = {
      width: redPropData.width,
      height: redPropData.height,
    };

    this.bluePropImage = newBlueImage;
    this.redPropImage = newRedImage;

    return {
      blue: this.bluePropImage,
      red: this.redPropImage,
    };
  }

  async loadPerColorPropImages(
    bluePropType: string,
    redPropType: string,
    darkMode?: boolean
  ): Promise<{
    blue: HTMLImageElement;
    red: HTMLImageElement;
  }> {
    const [bluePropData, redPropData] = await Promise.all([
      this.svgGenerator.generateBluePropSvg(bluePropType, darkMode),
      this.svgGenerator.generateRedPropSvg(redPropType, darkMode),
    ]);

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

    this.bluePropDimensions = {
      width: bluePropData.width,
      height: bluePropData.height,
    };
    this.redPropDimensions = {
      width: redPropData.width,
      height: redPropData.height,
    };

    this.bluePropImage = newBlueImage;
    this.redPropImage = newRedImage;

    return {
      blue: this.bluePropImage,
      red: this.redPropImage,
    };
  }

  async loadSecondaryPropImages(
    propType: string,
    blueColor: string,
    redColor: string
  ): Promise<{
    blue: HTMLImageElement;
    red: HTMLImageElement;
  }> {
    const [secondaryBluePropData, secondaryRedPropData] = await Promise.all([
      this.svgGenerator.generatePropSvg(propType, blueColor),
      this.svgGenerator.generatePropSvg(propType, redColor),
    ]);

    const [newBlueImage, newRedImage] = await Promise.all([
      this.createImageFromSVG(
        secondaryBluePropData.svg,
        secondaryBluePropData.width,
        secondaryBluePropData.height
      ),
      this.createImageFromSVG(
        secondaryRedPropData.svg,
        secondaryRedPropData.width,
        secondaryRedPropData.height
      ),
    ]);

    this.secondaryBluePropImage = newBlueImage;
    this.secondaryRedPropImage = newRedImage;

    return {
      blue: this.secondaryBluePropImage,
      red: this.secondaryRedPropImage,
    };
  }

  async loadGridImage(
    gridMode: string,
    canvasSize: number
  ): Promise<HTMLImageElement> {
    const gridSvg = this.svgGenerator.generateGridSvg(gridMode);

    const newImage = await this.createImageFromSVG(
      gridSvg,
      canvasSize,
      canvasSize
    );

    this.gridImage = newImage;
    return this.gridImage;
  }

  async loadGlyphImage(
    svgString: string,
    _width: number,
    _height: number
  ): Promise<{
    current: HTMLImageElement;
    previous: HTMLImageElement | null;
  }> {
    this.previousGlyphImage = null;

    if (this.glyphImage) {
      this.previousGlyphImage = this.glyphImage;
    }

    this.glyphImage = await this.createImageFromSVG(
      svgString,
      VIEWBOX_SIZE,
      VIEWBOX_SIZE
    );

    return {
      current: this.glyphImage,
      previous: this.previousGlyphImage,
    };
  }

  private async createImageFromSVG(
    svgString: string,
    width: number,
    height: number
  ): Promise<HTMLImageElement> {
    const base64 = btoa(unescape(encodeURIComponent(svgString)));
    const dataUrl = `data:image/svg+xml;base64,${base64}`;

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.width = width;
      img.height = height;

      img.onload = () => {
        img.onload = null;
        img.onerror = null;
        resolve(img);
      };

      img.onerror = () => {
        img.onload = null;
        img.onerror = null;
        reject(new Error("Failed to load SVG image"));
      };

      img.src = dataUrl;
    });
  }

  getBluePropImage(): HTMLImageElement | null {
    return this.bluePropImage;
  }

  getRedPropImage(): HTMLImageElement | null {
    return this.redPropImage;
  }

  getSecondaryBluePropImage(): HTMLImageElement | null {
    return this.secondaryBluePropImage;
  }

  getSecondaryRedPropImage(): HTMLImageElement | null {
    return this.secondaryRedPropImage;
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

  destroy(): void {
    this.bluePropImage = null;
    this.redPropImage = null;
    this.secondaryBluePropImage = null;
    this.secondaryRedPropImage = null;
    this.gridImage = null;
    this.glyphImage = null;
    this.previousGlyphImage = null;
  }
}
