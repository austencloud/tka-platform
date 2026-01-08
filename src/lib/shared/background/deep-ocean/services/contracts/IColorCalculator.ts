/**
 * Color manipulation utilities for fish rendering.
 * Handles alpha adjustments, brightness, blending, and color conversions.
 */
export interface IColorCalculator {
  /**
   * Adjust the alpha (opacity) of a color
   * @param color - Hex or rgba color string
   * @param alpha - New alpha value (0-1)
   * @returns rgba color string with adjusted alpha
   */
  adjustAlpha(color: string, alpha: number): string;

  /**
   * Adjust the brightness of a color
   * @param color - Hex or rgb color string
   * @param amount - Brightness adjustment (-255 to +255)
   * @returns rgb color string with adjusted brightness
   */
  adjustBrightness(color: string, amount: number): string;

  /**
   * Blend two colors together
   * @param color1 - First color (hex or rgb)
   * @param color2 - Second color (hex or rgb)
   * @param ratio - Blend ratio (0 = all color1, 1 = all color2)
   * @returns rgb color string of blended result
   */
  blendColors(color1: string, color2: string, ratio: number): string;

  /**
   * Shift the hue of a color
   * @param color - Hex or rgb color string
   * @param degrees - Hue shift in degrees (0-360)
   * @returns hsl color string with shifted hue
   */
  shiftHue(color: string, degrees: number): string;

  /**
   * Convert hex color to RGB object
   * @param hex - Hex, rgb, or rgba color string
   * @returns RGB values as object
   */
  hexToRgb(hex: string): { r: number; g: number; b: number };
}
