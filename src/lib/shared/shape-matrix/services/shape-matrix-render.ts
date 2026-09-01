import type {
  MandalaHandVisibility,
  MandalaPaths,
} from "$lib/shared/mandala/domain/mandala-types";
import { renderMandalaSVG } from "$lib/shared/mandala/services/mandala-renderer";

function paint(
  paths: MandalaPaths,
  show: MandalaHandVisibility,
  sizePx: number,
  tipDx: number
): string {
  const svg = renderMandalaSVG(paths, {
    size: sizePx,
    style: "stroke",
    show,
    strokeWidth: 2.4,
    tipDx,
  });
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
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
