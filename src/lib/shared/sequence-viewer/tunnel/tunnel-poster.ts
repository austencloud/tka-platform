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
