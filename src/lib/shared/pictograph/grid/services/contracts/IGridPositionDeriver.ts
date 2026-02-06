/**
 * Grid Position Deriver Interface
 *
 * Derives grid positions from hand locations and vice versa.
 */

import type { GridLocation, GridPosition } from "../../domain/enums/grid-enums";

export interface IGridPositionDeriver {
  /**
   * Get the hand location pair for a given position
   */
  getGridLocationsFromPosition(
    position: GridPosition
  ): [GridLocation, GridLocation];

  /**
   * Get the position for a given hand location pair
   */
  getGridPositionFromLocations(
    blueLocation: GridLocation,
    redLocation: GridLocation
  ): GridPosition;
}
