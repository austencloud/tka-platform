import type { GridLocation, GridPosition } from "@tka/types";

export interface IGridPositionDeriver {
  getGridLocationsFromPosition(
    position: GridPosition
  ): [GridLocation, GridLocation];

  getGridPositionFromLocations(
    blueLocation: GridLocation,
    redLocation: GridLocation
  ): GridPosition;
}
