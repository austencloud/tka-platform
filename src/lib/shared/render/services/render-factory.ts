/**
 * RenderFactory
 *
 * Environment-agnostic factory functions for creating canvases and loading images.
 * Works in both main thread and Web Workers using OffscreenCanvas + ImageBitmap.
 *
 * OffscreenCanvas: Chrome 69+, Firefox 105+, Safari 16.4+
 * createImageBitmap: Chrome 50+, Firefox 42+, Safari 15+
 */

import { sanitizeSvgForBitmap } from "./svg-bitmap-sanitize";

/**
 * Create a render canvas (works in both main thread and workers)
 */
export function createRenderCanvas(width: number, height: number): OffscreenCanvas {
  return new OffscreenCanvas(width, height);
}

export async function loadImageFromBlob(blob: Blob): Promise<ImageBitmap> {
  return createImageBitmap(blob);
}

/**
 * Load an ImageBitmap from a URL (fetches then decodes)
 */
export async function loadImageFromUrl(url: string): Promise<ImageBitmap> {
  const response = await fetch(url);
  const blob = await response.blob();
  return createImageBitmap(blob);
}

/**
 * Load an ImageBitmap from an SVG string.
 * Sanitizes SVG for createImageBitmap() compatibility (used in workers).
 */
export async function loadImageFromSvgString(svg: string): Promise<ImageBitmap> {
  const processed = sanitizeSvgForBitmap(svg);
  const blob = new Blob([processed], { type: "image/svg+xml;charset=utf-8" });
  return createImageBitmap(blob);
}

/**
 * Check if the current environment supports worker-based rendering.
 *
 * Disabled: createImageBitmap() in workers cannot reliably decode SVG blobs.
 * Errors are swallowed inside Canvas2DDirectRenderer draw methods, producing
 * partial renders (grid only, no props/arrows/glyphs). Main-thread rendering
 * uses HTMLImageElement which handles SVGs correctly.
 */
export function supportsWorkerRendering(): boolean {
  return false;
}
