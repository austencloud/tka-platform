/**
 * SVG Preload Service Interface
 *
 * Handles preloading and caching of SVG assets for optimal pictograph performance.
 */

export interface ISvgPreloader {
  preloadEssentialSvgs(): Promise<void>;
  preloadPropSvgs(propTypes: string[]): Promise<void>;
  preloadGridSvgs(): Promise<void>;
  preloadArrowSvgs(): Promise<void>;
  getSvgContent(
    type: "prop" | "grid" | "arrow",
    name: string
  ): Promise<string>;
  isCached(type: "prop" | "grid" | "arrow", name: string): boolean;
  getPreloadProgress(): {
    loaded: number;
    total: number;
    percentage: number;
  };
  clearCache(): void;
}
