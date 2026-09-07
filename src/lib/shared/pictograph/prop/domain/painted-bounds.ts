/**
 * Painted extent of a sprite capture: the pixels that carry alpha, expressed
 * in the pictograph box's own units. Model captures are grip-centred and
 * mirrored about the hand, so a one-sided prop (club, torch, poi) paints only
 * half its box; a picker tile crops to this window so the prop reads at the
 * same size as the notation glyph.
 */
export interface PaintedBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Alpha at or below this is clear: antialiasing fringe and encoder noise. */
export const PAINTED_ALPHA_THRESHOLD = 24;

/**
 * Pixel rectangle of an RGBA buffer's painted pixels, or null when nothing
 * is painted.
 */
export function paintedPixelBounds(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  threshold = PAINTED_ALPHA_THRESHOLD
): PaintedBounds | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width * 4;
    for (let x = 0; x < width; x++) {
      if (data[row + x * 4 + 3]! > threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/**
 * Painted rectangle of a rendered source (a WebGL canvas or a decoded image)
 * in box units, to a tenth of a unit. `pixelsPerUnit` is the source's scale.
 */
export function paintedBounds(
  source: CanvasImageSource,
  widthPx: number,
  heightPx: number,
  pixelsPerUnit: number,
  threshold = PAINTED_ALPHA_THRESHOLD
): PaintedBounds | null {
  const probe = document.createElement("canvas");
  probe.width = widthPx;
  probe.height = heightPx;
  const ctx = probe.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, widthPx, heightPx);
  const px = paintedPixelBounds(
    ctx.getImageData(0, 0, widthPx, heightPx).data,
    widthPx,
    heightPx,
    threshold
  );
  if (!px) return null;
  const units = (value: number) => Math.round((value / pixelsPerUnit) * 10) / 10;
  return {
    x: units(px.x),
    y: units(px.y),
    width: units(px.width),
    height: units(px.height),
  };
}
