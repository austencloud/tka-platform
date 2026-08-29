import { renderMandalaToCanvas } from "$lib/shared/mandala/services/mandala-renderer";
import {
  MANDALA_GRID_RADIUS,
  ENGINE_GRID_RADIUS,
} from "$lib/shared/mandala/domain/mandala-constants";
import type {
  MandalaPaths,
  MandalaPalette,
} from "$lib/shared/mandala/domain/mandala-types";
import {
  DARK_MOTION_BLUE_STROKE,
  DARK_MOTION_BLUE_FILL,
  DARK_MOTION_RED_STROKE,
  DARK_MOTION_RED_FILL,
  DARK_MOTION_PURPLE_STROKE,
  DARK_MOTION_PURPLE_FILL,
} from "$lib/shared/mandala/domain/mandala-constants";

const DARK_PALETTE: MandalaPalette = {
  blueStroke: DARK_MOTION_BLUE_STROKE,
  blueFill: DARK_MOTION_BLUE_FILL,
  redStroke: DARK_MOTION_RED_STROKE,
  redFill: DARK_MOTION_RED_FILL,
  purpleStroke: DARK_MOTION_PURPLE_STROKE,
  purpleFill: DARK_MOTION_PURPLE_FILL,
};

/**
 * Scale the mandala's hand circle to the engine hand orbit (150/950 viewbox)
 * so a mandala drawn in the same square as AnimatorCanvas lands exactly under
 * the prop's traced path. Same formula as the lab's
 * render-mandala-overlay-layer.ts (the MP4 bake proves the correspondence);
 * kept in sync by the contract test in shape-matrix-elemental-drill.test.ts.
 */
export function alignScale(clubTipDx: number): number {
  const GRID_HALFWAY = 150;
  const VIEWBOX = 950;
  const tipReach = (clubTipDx * MANDALA_GRID_RADIUS) / ENGINE_GRID_RADIUS;
  const maxExtent = MANDALA_GRID_RADIUS + tipReach;
  const mandalaHandFrac = MANDALA_GRID_RADIUS / (2 * maxExtent * 1.05);
  const engineHandFrac = GRID_HALFWAY / VIEWBOX;
  return engineHandFrac / mandalaHandFrac;
}

/** Paint both hands' loci, engine-aligned, into a square sizePx canvas ctx. */
export function drawAlignedMandala(
  ctx: CanvasRenderingContext2D,
  paths: MandalaPaths,
  sizePx: number,
  opts: { clubTipDx: number; opacity?: number }
): void {
  const { clubTipDx, opacity = 1 } = opts;
  const s = alignScale(clubTipDx);
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.translate(sizePx / 2, sizePx / 2);
  ctx.scale(s, s);
  ctx.translate(-sizePx / 2, -sizePx / 2);
  renderMandalaToCanvas(ctx, paths, {
    size: sizePx,
    style: "stroke",
    show: "both",
    tipDx: clubTipDx,
    palette: DARK_PALETTE,
    offsetX: 0,
    offsetY: 0,
  });
  ctx.restore();
}
