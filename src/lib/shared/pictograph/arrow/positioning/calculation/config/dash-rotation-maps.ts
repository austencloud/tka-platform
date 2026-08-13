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
  [GridLocation.CENTER]: 0,
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
  [GridLocation.CENTER]: 0,
};

/**
 * DASH rotation override maps from the OG desktop calculator's
 * DashRotAngleCalculator._get_rot_angle_override_according_to_loc().
 *
 * A DASH override quarter-turns the glyph. It cannot reuse the STATIC
 * override maps because those turn the glyph by 180 degrees instead.
 */
export const dashClockwiseOverrideMap: Partial<Record<GridLocation, number>> = {
  [GridLocation.NORTH]: 270,
  [GridLocation.EAST]: 0,
  [GridLocation.SOUTH]: 90,
  [GridLocation.WEST]: 180,
  [GridLocation.NORTHEAST]: 315,
  [GridLocation.SOUTHEAST]: 45,
  [GridLocation.SOUTHWEST]: 135,
  [GridLocation.NORTHWEST]: 225,
};

export const dashCounterClockwiseOverrideMap: Partial<
  Record<GridLocation, number>
> = {
  [GridLocation.NORTH]: 270,
  [GridLocation.EAST]: 180,
  [GridLocation.SOUTH]: 90,
  [GridLocation.WEST]: 0,
  [GridLocation.NORTHEAST]: 225,
  [GridLocation.SOUTHEAST]: 135,
  [GridLocation.SOUTHWEST]: 45,
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
