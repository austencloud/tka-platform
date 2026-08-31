import type { MandalaPaths } from "$lib/shared/mandala/domain/mandala-types";
import { renderMandalaSVG } from "$lib/shared/mandala/services/mandala-renderer";

function paint(
  paths: MandalaPaths,
  show: "blue" | "red" | "both",
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

/** Overlay one blue flower (rows) with one red flower (columns). */
export function renderCell(
  blue: MandalaPaths,
  red: MandalaPaths,
  sizePx: number,
  tipDx: number
): string {
  const merged: MandalaPaths = { blue: blue.blue, red: red.red, purple: [] };
  return paint(merged, "both", sizePx, tipDx);
}

/** A single axis-header flower. */
export function renderHeader(
  paths: MandalaPaths,
  hand: "blue" | "red",
  sizePx: number,
  tipDx: number
): string {
  return paint(paths, hand, sizePx, tipDx);
}
