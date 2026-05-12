/**
 * GridPositionDeriver — thin wrapper delegating to grid-position-deriver module functions.
 * Kept for backward-compatible DI injection across existing consumers.
 */

import type { GridLocation, GridPosition } from "../../domain/enums/grid-enums";
import {
  getGridLocationsFromPosition as _getGridLocations,
  getGridPositionFromLocations as _getGridPosition,
} from "../grid-position-deriver";

export class GridPositionDeriver {
  getGridLocationsFromPosition(
    position: GridPosition
  ): [GridLocation, GridLocation] {
    return _getGridLocations(position);
  }

  getGridPositionFromLocations(
    blueLocation: GridLocation,
    redLocation: GridLocation
  ): GridPosition {
    return _getGridPosition(blueLocation, redLocation);
  }
}

export const gridPositionDeriver = new GridPositionDeriver();
