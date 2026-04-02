/**
 * IPlaqueTextureGenerator
 *
 * Generates readable text textures for 3D museum plaques using OffscreenCanvas.
 * The returned canvas is intended for use as a Three.js CanvasTexture source.
 */

export interface PlaqueContent {
  title: string;
  subtitle?: string;
  body: string;
  footer?: string;
}

export type PlaqueSize = "standard" | "large" | "dev-whiteboard";

export interface IPlaqueTextureGenerator {
  /**
   * Render plaque content onto an OffscreenCanvas at the appropriate
   * resolution for the given size. Results are cached by cacheKey when
   * provided, so repeated calls with the same key skip rendering.
   */
  generateCanvas(
    content: PlaqueContent,
    size: PlaqueSize,
    cacheKey?: string,
  ): OffscreenCanvas;
}
