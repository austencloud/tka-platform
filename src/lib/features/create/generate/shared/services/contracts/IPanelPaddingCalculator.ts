/**
 * Panel Padding Calculator Service
 * Calculates responsive padding based on panel aspect ratio
 */

export interface PaddingValues {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface IPanelPaddingCalculator {
  /**
   * Calculate padding in pixels based on panel dimensions and aspect ratio
   * @param aspectRatio - Width / Height of the panel
   * @param width - Panel width in pixels
   * @param height - Panel height in pixels
   * @returns Padding in pixels for each side
   */
  calculatePadding(
    aspectRatio: number,
    width: number,
    height: number
  ): PaddingValues;
}
