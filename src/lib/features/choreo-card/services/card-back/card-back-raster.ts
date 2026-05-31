/**
 * card-back-raster.ts
 *
 * Worker-safe painter that renders a BackJob onto an OffscreenCanvas.
 * Runs on the main thread today (Phase 1); moves into a Web Worker in Phase 2.
 *
 * HARD CONSTRAINTS — enforced by this file's import list:
 *  - NO $app / $env / SvelteKit imports
 *  - NO Firebase / Svelte imports
 *  - NO SVG decoding (workers cannot createImageBitmap from an SVG blob)
 *  - Only canvas primitives + drawImage of pre-decoded ImageBitmaps
 *
 * This file imports NOTHING but types — it is a pure composite of the
 * pre-rasterized BackJob. The mandala is decoded on the main thread from the
 * exact renderMandalaSVG output (in the job builder) and arrives as a bitmap.
 *
 * Paint order (mirrors CardBack.svelte stacking):
 *   1. border gradient — full canvas
 *   2. bg gradient     — inner rect (inside the colored border)
 *   3. decorations     — drawImage of pre-decoded bitmap (optional)
 *   4. mandala         — drawImage of pre-decoded bitmap (optional)
 *   5. placed bitmaps  — one drawImage per PlacedBitmap
 */

import type { BackJob, GradientSpec } from "./back-job";

// ---------------------------------------------------------------------------
// Gradient helper — exported for unit tests
// ---------------------------------------------------------------------------

/**
 * Minimal shape of a canvas-like gradient receiver.  Using a structural type
 * lets the tests pass a fake without a real CanvasRenderingContext2D.
 */
export interface GradientReceiver {
  createLinearGradient(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
  ): { addColorStop(offset: number, color: string): void };
}

/**
 * Convert a CSS `linear-gradient` angle + stops into a canvas
 * `CanvasGradient` applied to the rectangle (x, y, w, h).
 *
 * CSS convention:
 *   0deg   = up   (toward the top of the box)
 *   90deg  = right
 *   180deg = down
 *   Increasing clockwise.
 *
 * The gradient line passes through the centre of the box and is long enough
 * to fully cover the corners (the standard CSS covering-geometry formula:
 *   len = |w·sin θ| + |h·cos θ|).
 */
export function applyLinearGradient(
  ctx: GradientReceiver,
  spec: GradientSpec,
  x: number,
  y: number,
  w: number,
  h: number,
): ReturnType<GradientReceiver["createLinearGradient"]> {
  const rad = (spec.angleDeg * Math.PI) / 180;
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad); // CSS 0deg = up = negative-y in canvas coords

  // Length of the gradient line that covers all corners of the box
  const len = Math.abs(w * dx) + Math.abs(h * dy);

  const cx = x + w / 2;
  const cy = y + h / 2;

  const x0 = cx - (dx * len) / 2;
  const y0 = cy - (dy * len) / 2;
  const x1 = cx + (dx * len) / 2;
  const y1 = cy + (dy * len) / 2;

  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const s of spec.stops) {
    g.addColorStop(Math.max(0, Math.min(1, s.offset)), s.color);
  }
  return g;
}

// ---------------------------------------------------------------------------
// Main painter
// ---------------------------------------------------------------------------

/**
 * Render `job` onto an OffscreenCanvas and return it.
 *
 * @param job          The fully-assembled BackJob (all bitmaps pre-decoded).
 * @param createCanvas Factory for the backing canvas.  Override in tests or
 *                     when the environment doesn't support OffscreenCanvas.
 */
export function paintBackJob(
  job: BackJob,
  createCanvas: (w: number, h: number) => OffscreenCanvas = (w, h) =>
    new OffscreenCanvas(w, h),
): OffscreenCanvas {
  const canvas = createCanvas(job.width, job.height);
  const ctx = canvas.getContext("2d") as OffscreenCanvasRenderingContext2D;

  // 1. Border gradient — fills the entire canvas (including bleed zone)
  ctx.fillStyle = applyLinearGradient(
    ctx,
    job.borderGradient,
    0,
    0,
    job.width,
    job.height,
  ) as unknown as string;
  ctx.fillRect(0, 0, job.width, job.height);

  // 2. Background gradient — fills the inner area (inside the colored border).
  //    Uses borderPx (NOT bleedPx) so the gradient border extends to the same
  //    inset as the content, matching the card-front frame's colored border.
  const ix = job.borderPx;
  const iy = job.borderPx;
  const iw = job.width - job.borderPx * 2;
  const ih = job.height - job.borderPx * 2;

  ctx.fillStyle = applyLinearGradient(
    ctx,
    job.bgGradient,
    ix,
    iy,
    iw,
    ih,
  ) as unknown as string;
  ctx.fillRect(ix, iy, iw, ih);

  // 3. Decorations — pre-decoded ImageBitmap, covers the inner area
  if (job.decorations) {
    ctx.save();
    ctx.globalAlpha = job.decorations.opacity;
    ctx.drawImage(job.decorations.bitmap, ix, iy, iw, ih);
    ctx.restore();
  }

  // 4. Mandala — pre-decoded ImageBitmap (rasterized from the exact
  //    renderMandalaSVG output the DOM card back uses, so glow/bloom/feather +
  //    purple-overlap mask are baked in). drawn into its layout box.
  if (job.mandala) {
    ctx.drawImage(
      job.mandala.bitmap,
      job.mandala.placement.x,
      job.mandala.placement.y,
      job.mandala.placement.w,
      job.mandala.placement.h,
    );
  }

  // 5. Placed bitmaps — layout bitmaps (brand, pictographs, glyphs, …)
  for (const pb of job.bitmaps) {
    ctx.drawImage(
      pb.bitmap,
      pb.placement.x,
      pb.placement.y,
      pb.placement.w,
      pb.placement.h,
    );
  }

  return canvas;
}
