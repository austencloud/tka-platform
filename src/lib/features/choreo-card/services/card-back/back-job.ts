export interface Placement { x: number; y: number; w: number; h: number; }

export type BackBitmapKind =
  | "brand" | "url-ornament" | "difficulty-badge" | "loop-icon"
  | "start-pos-pictograph" | "turn-glyph" | "reversal-glyph"
  | "step-count" | "loop-label";

export interface PlacedBitmap {
  kind: BackBitmapKind;
  bitmap: ImageBitmap;
  placement: Placement;
}

export interface GradientSpec {
  type: "linear";
  angleDeg: number;
  stops: { offset: number; color: string }[];
}

export interface BackJob {
  width: number;            // 1644 (822 * scale 2)
  height: number;           // 2244 (1122 * scale 2)
  bleedPx: number;          // 72 (36 * scale 2)
  borderGradient: GradientSpec;
  bgGradient: GradientSpec;
  // Decorations pre-rasterized on the MAIN thread (SVG -> Image -> ImageBitmap),
  // cached per theme, transferred. null in proof mode (decorationOpacity === 0).
  // The worker NEVER decodes SVG — createImageBitmap(svgBlob) fails in workers
  // for ALL svg in the target browser (proven in Phase 0).
  decorations: { bitmap: ImageBitmap; opacity: number } | null;
  // Mandala rendered on the MAIN thread via Path2D (renderMandalaToCanvas) +
  // a canvas shadowBlur glow that emulates the SVG feGaussianBlur glow/bloom,
  // returned as an ImageBitmap. This avoids the ~200ms-per-card SVG-filter
  // decode the prior path paid (65% of the whole back). null only if geometry
  // yields no drawable mandala. Drawn at its `placement` box, between
  // decorations and the placed bitmaps.
  mandala: { bitmap: ImageBitmap; placement: Placement } | null;
  bitmaps: PlacedBitmap[];
}
