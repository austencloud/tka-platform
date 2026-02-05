/**
 * SVG Image Service Contract
 *
 * Handles conversion of SVG strings to HTMLImageElement for canvas rendering.
 * This is different from SVGToCanvasConverter which converts to Canvas.
 */

export interface ISvgImageConverter {
  /**
   * Convert SVG string to HTMLImageElement
   * @param svgString - The SVG content as a string
   * @param width - Target width (for reference, actual size determined by SVG)
   * @param height - Target height (for reference, actual size determined by SVG)
   * @returns Promise that resolves to HTMLImageElement
   */
  convertSvgStringToImage(
    svgString: string,
    width: number,
    height: number
  ): Promise<HTMLImageElement>;

  /**
   * Convert multiple SVG strings to images in parallel
   * @param svgData - Array of objects with svgString and dimensions
   * @returns Promise that resolves to array of HTMLImageElements
   */
  convertMultipleSvgStringsToImages(
    svgData: Array<{
      svgString: string;
      width: number;
      height: number;
    }>
  ): Promise<HTMLImageElement[]>;

  /**
   * Validate SVG string before conversion
   * @param svgString - The SVG content to validate
   * @returns true if valid, false otherwise
   */
  validateSvgString(svgString: string): boolean;

  /**
   * Clean up any cached resources
   */
  cleanup(): void;
}
