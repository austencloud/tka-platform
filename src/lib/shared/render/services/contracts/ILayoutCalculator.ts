export interface ILayoutCalculator {
  /**
   * Calculate optimal layout for given beat count
   * Returns [columns, rows] matching desktop layout tables
   */
  calculateLayout(
    stepCount: number,
    includeStartPosition: boolean,
    startPositionLayout?: "row" | "column"
  ): [number, number];

  /**
   * Calculate image dimensions for layout
   * Returns [width, height] in pixels
   */
  calculateImageDimensions(
    layout: [number, number],
    additionalHeight: number,
    stepScale?: number,
    stepSize?: number
  ): [number, number];

  /**
   * Get layout for current beat grid (compatibility method)
   */
  getCurrentStepGridLayout(stepCount: number): [number, number];

  /**
   * Validate layout parameters
   */
  validateLayout(stepCount: number, includeStartPosition: boolean): boolean;

  /**
   * Calculate the aspect ratio for gallery thumbnails given a beat count.
   * Uses fixed gallery composition options (header + footer).
   *
   * @param stepCount Number of steps in the sequence (not including start position)
   * @returns Aspect ratio (width / height) for the gallery thumbnail
   */
  calculateGalleryAspectRatio(stepCount: number): number;

  /**
   * Calculate the aspect ratio for a thumbnail given beat count and options.
   * More flexible than calculateGalleryAspectRatio for custom compositions.
   */
  calculateThumbnailAspectRatio(
    stepCount: number,
    options?: {
      includeStartPosition?: boolean;
      hasHeader?: boolean;
      hasFooter?: boolean;
    }
  ): number;
}
