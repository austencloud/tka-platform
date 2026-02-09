/**
 * IGridGeometry - Grid point resolution
 *
 * Converts grid:location pairs to world coordinates given a GridPlacement.
 */

import type { GridLocation } from "$lib/shared/render/core/types";
import type { Vec2, GridPlacement } from "../../domain/models/GridTopology";

export interface IGridGeometry {
  /** Get the offset from grid center for a location (in abstract units, radius=1.0) */
  getLocationOffset(location: GridLocation): Vec2;

  /** Resolve a grid:location to world coordinates */
  resolveWorldPoint(grid: GridPlacement, location: GridLocation): Vec2;

  /** Get all valid locations for a grid mode */
  getLocationsForMode(mode: string): readonly GridLocation[];
}
