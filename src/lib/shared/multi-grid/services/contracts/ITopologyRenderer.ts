/**
 * ITopologyRenderer - ViewBox computation and world↔SVG mapping
 *
 * Maps abstract world coordinates to SVG pixel coordinates for rendering.
 */

import type { Vec2, GridTopology, GridPlacement } from "../../domain/models/GridTopology";

export interface ViewBoxData {
  /** SVG viewBox string: "minX minY width height" */
  readonly viewBox: string;
  /** Width in SVG units */
  readonly width: number;
  /** Height in SVG units */
  readonly height: number;
  /** Origin offset: minX, minY */
  readonly origin: Vec2;
}

export interface ITopologyRenderer {
  /** Compute the SVG viewBox that fits all grids with margin */
  computeViewBox(topology: GridTopology, pixelsPerUnit?: number, margin?: number): ViewBoxData;

  /** Convert world coordinates to SVG pixel coordinates */
  worldToSvg(worldPos: Vec2, pixelsPerUnit?: number, origin?: Vec2): Vec2;

  /** Get the SVG translation for a grid's center */
  gridCenterToSvg(grid: GridPlacement, pixelsPerUnit?: number, origin?: Vec2): Vec2;
}
