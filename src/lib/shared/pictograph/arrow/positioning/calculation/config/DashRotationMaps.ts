import { GridLocation } from "../../../../grid/domain/enums/grid-enums.ts";

/**
 * DASH arrow rotation maps.
 *
 * Includes special handling for NO_ROTATION cases based on start/end location pairs.
 */

export const dashClockwiseMap: Record<GridLocation, number> = {
  [GridLocation.NORTH]: 0,
  [GridLocation.EAST]: 90,
  [GridLocation.SOUTH]: 180,
  [GridLocation.WEST]: 270,
  [GridLocation.NORTHEAST]: 45,
  [GridLocation.SOUTHEAST]: 135,
  [GridLocation.SOUTHWEST]: 225,
  [GridLocation.NORTHWEST]: 315,
};

export const dashCounterClockwiseMap: Record<GridLocation, number> = {
  [GridLocation.NORTH]: 0,
  [GridLocation.EAST]: 90,
  [GridLocation.SOUTH]: 180,
  [GridLocation.WEST]: 270,
  [GridLocation.NORTHEAST]: 45,
  [GridLocation.SOUTHEAST]: 135,
  [GridLocation.SOUTHWEST]: 225,
  [GridLocation.NORTHWEST]: 315,
};

/**
 * Special rotation angles for NO_ROTATION dash movements.
 * Key format: "startLocation,endLocation"
 */
export const dashNoRotationMap: Record<string, number> = {
  [`${GridLocation.NORTH},${GridLocation.SOUTH}`]: 90,
  [`${GridLocation.EAST},${GridLocation.WEST}`]: 180,
  [`${GridLocation.SOUTH},${GridLocation.NORTH}`]: 270,
  [`${GridLocation.WEST},${GridLocation.EAST}`]: 0,
  [`${GridLocation.SOUTHEAST},${GridLocation.NORTHWEST}`]: 225,
  [`${GridLocation.SOUTHWEST},${GridLocation.NORTHEAST}`]: 315,
  [`${GridLocation.NORTHWEST},${GridLocation.SOUTHEAST}`]: 45,
  [`${GridLocation.NORTHEAST},${GridLocation.SOUTHWEST}`]: 135,
};
