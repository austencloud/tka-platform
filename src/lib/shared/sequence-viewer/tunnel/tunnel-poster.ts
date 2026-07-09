/** Edge length of the square poster thumbnail stored per saved tunnel. Small so
 *  the WebP data URL stays a few KB (well under the Firestore 1MB doc limit). */
export const POSTER_SIZE = 200;

type CanvasFactory = () => HTMLCanvasElement;

const defaultFactory: CanvasFactory = () => document.createElement("canvas");

/**
 * Downscale a rendered tunnel canvas to a POSTER_SIZE² WebP data URL. Cover-fits
 * (center-crop) so the roughly-circular pattern fills the square. Returns "" if
 * the source is empty or a 2D context can't be obtained.
 */
export function captureTunnelPoster(
  source: HTMLCanvasElement,
  makeCanvas: CanvasFactory = defaultFactory,
): string {
  const sw = source.width;
  const sh = source.height;
  if (!sw || !sh) return "";

  const target = makeCanvas();
  target.width = POSTER_SIZE;
  target.height = POSTER_SIZE;
  const ctx = target.getContext("2d");
  if (!ctx) return "";

  // Cover fit: crop the source to a centered square, scale into the poster.
  const side = Math.min(sw, sh);
  const sx = (sw - side) / 2;
  const sy = (sh - side) / 2;
  ctx.clearRect(0, 0, POSTER_SIZE, POSTER_SIZE);
  ctx.drawImage(source, sx, sy, side, side, 0, 0, POSTER_SIZE, POSTER_SIZE);

  return target.toDataURL("image/webp", 0.8);
}

/**
 * Composite EVERY rendered `<canvas>` layer inside a stage container (props +
 * trails + effect overlays — DOM order ≈ paint/z-order) into one POSTER_SIZE²
 * WebP data URL. The tunnel renders in stacked sibling canvases, so grabbing just
 * the first one loses the trails/effects; this overlays them all so the thumbnail
 * matches what the user sees. Each layer overlays the same stage box, so each is
 * cropped to its own centered square and drawn into the full poster. Returns "" if
 * no drawable layer / no 2D context. (A WebGL layer without preserveDrawingBuffer
 * may draw empty — harmless: it composites transparent over the 2D layers.)
 */
export function capturePosterFromContainer(
  container: HTMLElement | null | undefined,
  makeCanvas: CanvasFactory = defaultFactory,
): string {
  if (!container) return "";
  const layers = Array.from(container.querySelectorAll("canvas")).filter(
    (c) => c.width > 0 && c.height > 0,
  );
  if (layers.length === 0) return "";

  const target = makeCanvas();
  target.width = POSTER_SIZE;
  target.height = POSTER_SIZE;
  const ctx = target.getContext("2d");
  if (!ctx) return "";
  ctx.clearRect(0, 0, POSTER_SIZE, POSTER_SIZE);

  for (const layer of layers) {
    const ls = Math.min(layer.width, layer.height);
    const lsx = (layer.width - ls) / 2;
    const lsy = (layer.height - ls) / 2;
    try {
      ctx.drawImage(layer, lsx, lsy, ls, ls, 0, 0, POSTER_SIZE, POSTER_SIZE);
    } catch {
      // A cross-origin-tainted or unreadable layer — skip it, keep the rest.
    }
  }

  return target.toDataURL("image/webp", 0.8);
}
