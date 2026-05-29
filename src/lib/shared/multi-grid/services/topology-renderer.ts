/**
 * Topology Renderer - Maps topology world coordinates to SVG pixel coordinates
 */

import type { Vec2, GridTopology, GridPlacement } from "../domain/models/grid-topology";
import type { ViewBoxData } from "./types";
import { PIXELS_PER_UNIT, SVG_CENTER } from "../domain/constants/grid-mode-offsets";

const DEFAULT_MARGIN = 100;

export function computeTopologyViewBox(
  topology: GridTopology,
  pixelsPerUnit: number = PIXELS_PER_UNIT,
  margin: number = DEFAULT_MARGIN,
): ViewBoxData {
  if (topology.grids.length === 0) {
    return {
      viewBox: "0 0 950 950",
      width: 950,
      height: 950,
      origin: { x: 0, y: 0 },
    };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const wp of topology.worldPoints) {
    const svgX = wp.position.x * pixelsPerUnit;
    const svgY = wp.position.y * pixelsPerUnit;
    minX = Math.min(minX, svgX);
    maxX = Math.max(maxX, svgX);
    minY = Math.min(minY, svgY);
    maxY = Math.max(maxY, svgY);
  }

  const gridPadding = SVG_CENTER;
  const totalMargin = margin + gridPadding;

  const viewMinX = minX - totalMargin;
  const viewMinY = minY - totalMargin;
  const viewWidth = maxX - minX + totalMargin * 2;
  const viewHeight = maxY - minY + totalMargin * 2;

  return {
    viewBox: `${Math.round(viewMinX)} ${Math.round(viewMinY)} ${Math.round(viewWidth)} ${Math.round(viewHeight)}`,
    width: Math.round(viewWidth),
    height: Math.round(viewHeight),
    origin: { x: viewMinX, y: viewMinY },
  };
}

export function worldToSvg(
  worldPos: Vec2,
  pixelsPerUnit: number = PIXELS_PER_UNIT,
): Vec2 {
  return {
    x: worldPos.x * pixelsPerUnit,
    y: worldPos.y * pixelsPerUnit,
  };
}

export function gridCenterToSvg(
  grid: GridPlacement,
  pixelsPerUnit: number = PIXELS_PER_UNIT,
): Vec2 {
  return {
    x: grid.center.x * pixelsPerUnit - SVG_CENTER,
    y: grid.center.y * pixelsPerUnit - SVG_CENTER,
  };
}
