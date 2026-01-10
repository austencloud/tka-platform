export interface ILayoutCalculator {
  /**
   * Calculate optimal layout for given beat count
   * Returns [columns, rows] matching desktop layout tables
   */
  calculateLayout(
    beatCount: number,
    includeStartPosition: boolean
  ): [number, number];

  /**
   * Calculate image dimensions for layout
   * Returns [width, height] in pixels
   */
  calculateImageDimensions(
    layout: [number, number],
    additionalHeight: number,
    beatScale?: number,
    beatSize?: number
  ): [number, number];

  /**
   * Get layout for current beat grid (compatibility method)
   */
  getCurrentBeatGridLayout(beatCount: number): [number, number];

  /**
   * Validate layout parameters
   */
  validateLayout(beatCount: number, includeStartPosition: boolean): boolean;

  /**
   * Calculate the aspect ratio for gallery thumbnails given a beat count.
   * Uses fixed gallery composition options (header + footer).
   *
   * @param beatCount Number of beats in the sequence (not including start position)
   * @returns Aspect ratio (width / height) for the gallery thumbnail
   */
  calculateGalleryAspectRatio(beatCount: number): number;

  /**
   * Calculate the aspect ratio for a thumbnail given beat count and options.
   * More flexible than calculateGalleryAspectRatio for custom compositions.
   */
  calculateThumbnailAspectRatio(
    beatCount: number,
    options?: {
      includeStartPosition?: boolean;
      hasHeader?: boolean;
      hasFooter?: boolean;
    }
  ): number;
}
