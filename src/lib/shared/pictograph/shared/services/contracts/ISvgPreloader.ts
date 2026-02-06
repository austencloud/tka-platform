/**
 * SVG Preload Service Interface
 *
 * Handles preloading and caching of SVG assets for optimal pictograph performance.
 * Eliminates the visible delay between grid and prop loading.
 */

export interface ISvgPreloader {
  /**
   * Preload all essential SVG assets
   */
  preloadEssentialSvgs(): Promise<void>;

  /**
   * Preload SVGs for specific prop types
   */
  preloadPropSvgs(propTypes: string[]): Promise<void>;

  /**
   * Preload grid SVGs
   */
  preloadGridSvgs(): Promise<void>;

  /**
   * Preload arrow SVGs
   */
  preloadArrowSvgs(): Promise<void>;

  /**
   * Get preloaded SVG content (returns immediately if cached)
   */
  getSvgContent(type: "prop" | "grid" | "arrow", name: string): Promise<string>;

  /**
   * Check if SVG is already cached
   */
  isCached(type: "prop" | "grid" | "arrow", name: string): boolean;

  /**
   * Get preload progress (for loading indicators)
   */
  getPreloadProgress(): {
    loaded: number;
    total: number;
    percentage: number;
  };

  /**
   * Clear cache (for development/testing)
   */
  clearCache(): void;
}
