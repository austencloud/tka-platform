export const GLYPH_OVERLAY_BASE_SIZE = 950;

export type GlyphOverlayFrameMode = "pictograph" | "stage";

export interface GlyphOverlayFrame {
  width: number;
  height: number;
  centerX: number;
  rightOffset: number;
  bottomOffset: number;
}

/**
 * Expand the pictograph coordinate system along the container's longer axis.
 * SVG units stay square, so the artwork never stretches; only annotations that
 * deliberately own a stage edge use the returned offsets.
 */
export function calculateGlyphOverlayFrame(
  mode: GlyphOverlayFrameMode,
  containerWidth: number,
  containerHeight: number
): GlyphOverlayFrame {
  const validSize = containerWidth > 0 && containerHeight > 0;
  if (mode === "pictograph" || !validSize) {
    return {
      width: GLYPH_OVERLAY_BASE_SIZE,
      height: GLYPH_OVERLAY_BASE_SIZE,
      centerX: GLYPH_OVERLAY_BASE_SIZE / 2,
      rightOffset: 0,
      bottomOffset: 0,
    };
  }

  const aspectRatio = containerWidth / containerHeight;
  const width =
    aspectRatio >= 1
      ? GLYPH_OVERLAY_BASE_SIZE * aspectRatio
      : GLYPH_OVERLAY_BASE_SIZE;
  const height =
    aspectRatio >= 1
      ? GLYPH_OVERLAY_BASE_SIZE
      : GLYPH_OVERLAY_BASE_SIZE / aspectRatio;

  return {
    width,
    height,
    centerX: width / 2,
    rightOffset: width - GLYPH_OVERLAY_BASE_SIZE,
    bottomOffset: height - GLYPH_OVERLAY_BASE_SIZE,
  };
}
