/**
 * RenderFactory
 *
 * Environment-agnostic factory functions for creating canvases and loading images.
 * Works in both main thread and Web Workers using OffscreenCanvas + ImageBitmap.
 *
 * OffscreenCanvas: Chrome 69+, Firefox 105+, Safari 16.4+
 * createImageBitmap: Chrome 50+, Firefox 42+, Safari 15+
 */

/**
 * Create a render canvas (works in both main thread and workers)
 */
export function createRenderCanvas(width: number, height: number): OffscreenCanvas {
  return new OffscreenCanvas(width, height);
}

/**
 * Load an ImageBitmap from a Blob
 */
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
 * Load an ImageBitmap from an SVG string
 */
export async function loadImageFromSvgString(svg: string): Promise<ImageBitmap> {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  return createImageBitmap(blob);
}

/**
 * Check if the current environment supports worker-based rendering
 */
export function supportsWorkerRendering(): boolean {
  return (
    typeof Worker !== "undefined" &&
    typeof OffscreenCanvas !== "undefined" &&
    typeof createImageBitmap !== "undefined"
  );
}
