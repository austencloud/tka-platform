/**
 * GridGeometry - Resolves grid:location pairs to world coordinates
 *
 * Pure functions: no state, no side effects.
 */

import type { GridLocation, GridMode } from "$lib/shared/render/core/types";
import type { Vec2, GridPlacement } from "../../domain/models/GridTopology";
import {
  LOCATION_OFFSETS,
  HAND_POINT_LOCATIONS,
  PERIMETER_LOCATIONS,
} from "../../domain/constants/GridModeOffsets";

export class GridGeometry {
  getLocationOffset(location: GridLocation): Vec2 {
    return LOCATION_OFFSETS[location];
  }

  resolveWorldPoint(grid: GridPlacement, location: GridLocation): Vec2 {
    const offset = LOCATION_OFFSETS[location];
    return {
      x: grid.center.x + offset.x * grid.radius,
      y: grid.center.y + offset.y * grid.radius,
    };
  }

  getLocationsForMode(mode: string): readonly GridLocation[] {
    // For topology, all 9 locations are valid targets.
    // But for "which are hand points," use the mode-specific set.
    const handPoints = HAND_POINT_LOCATIONS[mode as GridMode];
    if (handPoints) return handPoints;

    // Fallback: all perimeter + center
    return [...PERIMETER_LOCATIONS, "c" as GridLocation];
  }
}
