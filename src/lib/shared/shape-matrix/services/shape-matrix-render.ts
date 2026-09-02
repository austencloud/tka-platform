/**
 * Shape Matrix still renderers. Every image here is painted by the animation
 * canvas's own guide painter (`renderMandalaGuideImage`), in the animation
 * canvas's own hand colors and stroke, so a tile, a header, and the detail
 * hero's floor are the mandala the animator draws — not a lookalike.
 */
import type {
  MandalaHandVisibility,
  MandalaPaths,
} from "$lib/shared/mandala/domain/mandala-types";
import { DEFAULT_MANDALA_OVERLAY_CONFIG } from "$lib/shared/mandala/domain/mandala-overlay-types";
import {
  renderMandalaGuideImage,
  type MandalaGuideFit,
  type MandalaGuideImageDependencies,
} from "$lib/shared/mandala/services/mandala-guide-image";
import { HERO_TRAIL_PRESET } from "$lib/shared/landing/data/hero-trail-preset";

/**
 * The hand colors every Shape Matrix still uses — the same preset the detail
 * animator plays with, so the still and the live guide share ink by data.
 */
export const SHAPE_MATRIX_GUIDE_COLORS = {
  left: HERO_TRAIL_PRESET.leftColor,
  right: HERO_TRAIL_PRESET.rightColor,
} as const;

/** Stroke width in CSS pixels; the live overlay's default. */
export const SHAPE_MATRIX_GUIDE_STROKE_WIDTH =
  DEFAULT_MANDALA_OVERLAY_CONFIG.strokeWidth;

export interface ShapeMatrixPaintOptions {
  /** Device pixels per CSS pixel; defaults to the window's. */
  dpr?: number;
  deps?: MandalaGuideImageDependencies;
}

function paint(
  paths: MandalaPaths,
  show: MandalaHandVisibility,
  sizePx: number,
  tipDx: number,
  fit: MandalaGuideFit,
  options: ShapeMatrixPaintOptions = {}
): string {
  return renderMandalaGuideImage(
    paths,
    {
      size: sizePx,
      dpr: options.dpr,
      show,
      leftColor: SHAPE_MATRIX_GUIDE_COLORS.left,
      rightColor: SHAPE_MATRIX_GUIDE_COLORS.right,
      strokeWidth: SHAPE_MATRIX_GUIDE_STROKE_WIDTH,
      fit,
      tipDx,
    },
    options.deps
  );
}

/** Overlay one left-hand flower (rows) with one right-hand flower (columns). */
export function renderCell(
  left: MandalaPaths,
  right: MandalaPaths,
  sizePx: number,
  tipDx: number,
  options?: ShapeMatrixPaintOptions
): string {
  const merged: MandalaPaths = { left: left.left, right: right.right, purple: [] };
  return paint(merged, "both", sizePx, tipDx, "extent", options);
}

/** A single axis-header flower. */
export function renderHeader(
  paths: MandalaPaths,
  hand: "left" | "right",
  sizePx: number,
  tipDx: number,
  options?: ShapeMatrixPaintOptions
): string {
  return paint(paths, hand, sizePx, tipDx, "extent", options);
}

/**
 * Both hands at the animation engine's alignment for a square of `sizePx`:
 * stacked over an AnimatorCanvas of the same square, the strokes sit exactly
 * where the live guide paints them.
 */
export function renderEngineAligned(
  paths: MandalaPaths,
  sizePx: number,
  options?: ShapeMatrixPaintOptions
): string {
  return paint(paths, "both", sizePx, 0, "engine", options);
}
