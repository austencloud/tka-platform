/**
 * ITriGridCalculator - Geometry engine for the 3-point equilateral triangle grid.
 *
 * Computes hand point positions, arc paths for shift motions, and arrowheads.
 */

import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { Point, TriGridMode, TriGridArcData } from "../../domain/trigrid-types";

export interface ITriGridCalculator {
  /** Get all 3 hand point coordinates for the given mode */
  getHandPoints(mode: TriGridMode): Map<GridLocation, Point>;

  /** Get all 3 outer marker coordinates for the given mode */
  getOuterMarkers(mode: TriGridMode): Map<GridLocation, Point>;

  /** Compute a 120-degree arc path between two adjacent vertices */
  computeArcPath(
    from: GridLocation,
    to: GridLocation,
    clockwise: boolean,
    mode: TriGridMode,
  ): TriGridArcData;

  /** Get adjacent vertices (CW and CCW neighbors) for a given vertex */
  getAdjacentPoints(
    point: GridLocation,
    mode: TriGridMode,
  ): { cw: GridLocation; ccw: GridLocation };

  /**
   * Compute the absolute SVG rotation angle for a prop at a given location and orientation.
   *
   * The prop SVG points "right" by default (0 degrees).
   * This method converts the center-relative orientation + grid location into an absolute angle.
   */
  computePropRotation(
    location: GridLocation,
    orientation: Orientation,
    mode: TriGridMode,
  ): number;
}
