import type { MandalaHandVisibility, MandalaPaths } from "$lib/shared/mandala/domain/mandala-types";
import { renderMandalaToCanvas } from "$lib/shared/mandala/services/mandala-renderer";

function paint(
  paths: MandalaPaths,
  show: MandalaHandVisibility,
  sizePx: number,
  tipDx: number
): string {
  const off = new OffscreenCanvas(sizePx, sizePx);
  const ctx = off.getContext("2d") as unknown as CanvasRenderingContext2D;
  renderMandalaToCanvas(ctx, paths, {
    size: sizePx,
    style: "stroke",
    show,
    strokeWidth: 2.4,
    tipDx,
    offsetX: 0,
    offsetY: 0,
    glow: { blur: Math.max(2, sizePx * 0.012) },
  });
  return offscreenToDataURL(off);
}

function offscreenToDataURL(off: OffscreenCanvas): string {
  const c = document.createElement("canvas");
  c.width = off.width;
  c.height = off.height;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(off as unknown as CanvasImageSource, 0, 0);
  return c.toDataURL("image/png");
}

/** Overlay one left-hand flower (rows) with one right-hand flower (columns). */
export function renderCell(
  left: MandalaPaths,
  right: MandalaPaths,
  sizePx: number,
  tipDx: number
): string {
  const merged: MandalaPaths = { left: left.left, right: right.right, purple: [] };
  return paint(merged, "both", sizePx, tipDx);
}

/** A single axis-header flower. */
export function renderHeader(
  paths: MandalaPaths,
  hand: "left" | "right",
  sizePx: number,
  tipDx: number
): string {
  return paint(paths, hand, sizePx, tipDx);
}
