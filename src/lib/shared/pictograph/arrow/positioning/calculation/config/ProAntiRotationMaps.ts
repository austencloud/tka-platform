import { GridLocation } from "../../../../grid/domain/enums/grid-enums.ts";

/**
 * PRO and ANTI arrow rotation maps.
 *
 * PRO rotation angles - FIXED to match legacy implementation
 * ANTI clockwise = PRO counter-clockwise
 * ANTI counter-clockwise = PRO clockwise
 */

// PRO rotation angles
export const proClockwiseMap: Record<GridLocation, number> = {
  [GridLocation.NORTH]: 315,
  [GridLocation.EAST]: 45,
  [GridLocation.SOUTH]: 135,
  [GridLocation.WEST]: 225,
  [GridLocation.NORTHEAST]: 0,
  [GridLocation.SOUTHEAST]: 90,
  [GridLocation.SOUTHWEST]: 180,
  [GridLocation.NORTHWEST]: 270,
};

export const proCounterClockwiseMap: Record<GridLocation, number> = {
  [GridLocation.NORTH]: 45,
  [GridLocation.EAST]: 135,
  [GridLocation.SOUTH]: 225,
  [GridLocation.WEST]: 315,
  [GridLocation.NORTHEAST]: 90,
  [GridLocation.SOUTHEAST]: 180,
  [GridLocation.SOUTHWEST]: 270,
  [GridLocation.NORTHWEST]: 0,
};

// ANTI rotation angles
export const antiClockwiseMap: Record<GridLocation, number> = {
  [GridLocation.NORTH]: 45,
  [GridLocation.EAST]: 135,
  [GridLocation.SOUTH]: 225,
  [GridLocation.WEST]: 315,
  [GridLocation.NORTHEAST]: 90,
  [GridLocation.SOUTHEAST]: 180,
  [GridLocation.SOUTHWEST]: 270,
  [GridLocation.NORTHWEST]: 0,
};

export const antiCounterClockwiseMap: Record<GridLocation, number> = {
  [GridLocation.NORTH]: 315,
  [GridLocation.EAST]: 45,
  [GridLocation.SOUTH]: 135,
  [GridLocation.WEST]: 225,
  [GridLocation.NORTHEAST]: 0,
  [GridLocation.SOUTHEAST]: 90,
  [GridLocation.SOUTHWEST]: 180,
  [GridLocation.NORTHWEST]: 270,
};
