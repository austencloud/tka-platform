/**
 * Service for calculating responsive typography values
 * Centralizes responsive font size calculations for consistent UI scaling
 */
export interface IResponsiveTypographer {
  /**
   * Calculate responsive font size with smooth easing
   * Uses viewport width to scale between min and max values with easing curve
   *
   * @param minSize - Minimum font size in pixels
   * @param maxSize - Maximum font size in pixels
   * @param vwMultiplier - Viewport width multiplier (e.g., 1.2 for 1.2vw)
   * @returns Calculated font size as CSS string (e.g., "12.5px")
   */
  calculateResponsiveFontSize(
    minSize: number,
    maxSize: number,
    vwMultiplier: number
  ): string;

  /**
   * Get current viewport width
   * @returns Current window inner width in pixels
   */
  getViewportWidth(): number;
}
