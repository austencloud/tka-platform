import type { IResponsiveTypographer } from "../contracts/IResponsiveTypographer";

/**
 * Implementation of IResponsiveTypographer
 * Provides responsive typography calculations with smooth easing
 */
export class ResponsiveTypographer implements IResponsiveTypographer {
  /**
   * Calculate responsive font size with smooth easing curve
   * Applies a gentle easing function to reduce abrupt jumps at rounding thresholds
   */
  calculateResponsiveFontSize(
    minSize: number,
    maxSize: number,
    vwMultiplier: number
  ): string {
    const viewportWidth = this.getViewportWidth();
    const vwValue = (viewportWidth / 100) * vwMultiplier; // Convert vw to pixels
    const clampedValue = Math.max(minSize, Math.min(vwValue, maxSize)); // clamp(min, value, max)

    // Apply smooth easing to reduce abrupt jumps when rounding
    // This creates gentler transitions at threshold boundaries (e.g., 10.28)
    const range = maxSize - minSize;
    const easedValue =
      minSize +
      (clampedValue - minSize) *
        Math.pow((clampedValue - minSize) / range, 0.85);

    // Use one decimal place for smoother transitions (browsers support sub-pixel rendering)
    return `${easedValue.toFixed(1)}px`;
  }

  /**
   * Get current viewport width
   */
  getViewportWidth(): number {
    return window.innerWidth;
  }
}
