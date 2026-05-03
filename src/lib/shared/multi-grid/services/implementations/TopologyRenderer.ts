/**
 * TopologyRenderer - Maps topology world coordinates to SVG pixel coordinates
 *
 * The canonical SVG coordinate system uses 950x950 per grid with center at (475, 475).
 * This renderer maps abstract world coordinates (radius=1.0) to that pixel space,
 * with dynamic viewBox computation that expands to fit N grids.
 */

import type { Vec2, GridTopology, GridPlacement } from "../../domain/models/GridTopology";
import type { ViewBoxData } from "../contracts/types";
import { PIXELS_PER_UNIT, SVG_CENTER } from "../../domain/constants/GridModeOffsets";

/** Default margin around the topology in SVG units */
const DEFAULT_MARGIN = 100;

export class TopologyRenderer {
  computeViewBox(
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

    // Find bounding box of all world points
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

    // Add margin for grid elements that extend beyond hand points
    // (outer points are at 2x radius, plus line thickness and labels)
    const gridPadding = SVG_CENTER; // Half a grid's width for the elements around hand points
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

  worldToSvg(
    worldPos: Vec2,
    pixelsPerUnit: number = PIXELS_PER_UNIT,
  ): Vec2 {
    return {
      x: worldPos.x * pixelsPerUnit,
      y: worldPos.y * pixelsPerUnit,
    };
  }

  gridCenterToSvg(
    grid: GridPlacement,
    pixelsPerUnit: number = PIXELS_PER_UNIT,
  ): Vec2 {
    // Grid's SVG origin is offset so that the grid center (475, 475) aligns with the world center
    return {
      x: grid.center.x * pixelsPerUnit - SVG_CENTER,
      y: grid.center.y * pixelsPerUnit - SVG_CENTER,
    };
  }
}
