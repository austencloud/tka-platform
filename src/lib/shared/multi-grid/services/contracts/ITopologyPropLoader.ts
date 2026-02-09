/**
 * ITopologyPropLoader - Loads prop render data for topology visualization
 *
 * Computes position, rotation, and SVG content for a prop at a given
 * grid location. Used by TopologyCanvas to render props without the
 * full pictograph pipeline (which requires MotionData, placement data,
 * animation visibility manager, etc.).
 *
 * Uses strict hand point coordinates (150px from center) to align
 * with the topology's strict grid mode.
 */

import type { GridLocation, GridMode } from "$lib/shared/render/core/types";

/** Render-ready prop data for direct SVG rendering */
export interface TopologyPropRenderData {
  /** SVG content string (colored, ready to render) */
  readonly svgContent: string;
  /** SVG viewBox dimensions */
  readonly viewBox: { width: number; height: number };
  /** SVG center point for transform origin */
  readonly center: { x: number; y: number };
  /** Position in 950x950 grid space (strict coordinates) */
  readonly position: { x: number; y: number };
  /** Rotation angle in degrees */
  readonly rotation: number;
}

export interface ITopologyPropLoader {
  /**
   * Load prop render data for a specific grid location.
   *
   * @param location - Grid location (n, e, s, w, ne, se, sw, nw)
   * @param gridMode - Grid mode (diamond, box, skewed)
   * @param color - "blue" or "red"
   * @param propType - Prop type string (e.g., "staff", "fan")
   * @param darkMode - Whether to use dark mode colors
   * @returns Render-ready prop data, or null on load failure
   */
  loadProp(
    location: GridLocation,
    gridMode: GridMode,
    color: "blue" | "red",
    propType: string,
    darkMode: boolean,
  ): Promise<TopologyPropRenderData | null>;
}
