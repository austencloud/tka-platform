/**
 * Fish Sprite Manager Contract
 *
 * Interface for managing pre-rendered fish sprites with color variants.
 */

/** Pre-rendered sprite with cached canvas */
export interface PreRenderedSprite {
  sprite: { name: string; path: string };
  canvas: HTMLCanvasElement | OffscreenCanvas;
  width: number;
  height: number;
  hueRotate: number;
}

/** Fish Sprite Manager interface */
export interface IFishSpriteManager {
  /**
   * Preload and pre-render all fish sprites
   */
  preloadSprites(): Promise<void>;

  /**
   * Get a random pre-rendered sprite
   */
  getRandomSpriteEntry(): PreRenderedSprite | undefined;

  /**
   * Get any loaded sprite (for fallback)
   */
  getAnyLoadedSpriteEntry(): PreRenderedSprite | undefined;

  /**
   * Get a random color for marine life
   */
  getMarineLifeColor(type: "fish" | "jellyfish"): string;

  /**
   * Check if sprites are loaded and ready
   */
  isReady(): boolean;
}
