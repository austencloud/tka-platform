/**
 * SVG Sprite Sheet Service Contract
 *
 * Provides SVG sprite sheet functionality for maximum performance optimization.
 * This is the second-tier optimization after pictograph caching.
 */

export interface ISvgSpriteSheet {
  /**
   * Initialize the sprite sheet service
   */
  initialize(): Promise<void>;

  /**
   * Generate a sprite sheet for a collection of SVG elements
   * @param svgElements - Collection of SVG elements to include in sprite sheet
   * @param spriteSheetId - Unique identifier for the sprite sheet
   * @returns Promise resolving to the sprite sheet SVG content
   */
  generateSpriteSheet(
    svgElements: Map<string, SVGElement>,
    spriteSheetId: string
  ): Promise<string>;

  /**
   * Get a reference to an SVG element within a sprite sheet
   * @param spriteSheetId - Sprite sheet identifier
   * @param elementId - Element identifier within the sprite sheet
   * @returns SVG use element referencing the sprite
   */
  getSpriteReference(
    spriteSheetId: string,
    elementId: string
  ): SVGUseElement | null;

  /**
   * Check if a sprite sheet exists
   * @param spriteSheetId - Sprite sheet identifier
   * @returns True if sprite sheet exists
   */
  hasSpriteSheet(spriteSheetId: string): boolean;

  /**
   * Inject sprite sheet into the DOM
   * @param spriteSheetId - Sprite sheet identifier
   * @param spriteSheetContent - SVG sprite sheet content
   */
  injectSpriteSheet(spriteSheetId: string, spriteSheetContent: string): void;

  /**
   * Get sprite sheet statistics
   * @returns Sprite sheet usage statistics
   */
  getStatistics(): SpriteSheetStats;

  /**
   * Clear all sprite sheets
   */
  clearSpriteSheets(): void;
}

/**
 * Sprite sheet usage statistics
 */
export interface SpriteSheetStats {
  /** Number of sprite sheets created */
  spriteSheetCount: number;
  /** Total number of sprites across all sheets */
  totalSprites: number;
  /** Number of sprite references created */
  referenceCount: number;
  /** Memory usage estimate in bytes */
  memoryUsage: number;
  /** Performance improvement estimate */
  performanceGain: string;
}

/**
 * Sprite sheet configuration options
 */
export interface SpriteSheetConfig {
  /** Maximum number of sprites per sheet */
  maxSpritesPerSheet: number;
  /** Whether to optimize sprite positioning */
  optimizePositioning: boolean;
  /** Whether to compress sprite sheet content */
  compressContent: boolean;
  /** Sprite sheet container element ID */
  containerId: string;
}
