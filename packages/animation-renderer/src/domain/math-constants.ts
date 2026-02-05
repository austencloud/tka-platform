import { GridLocation } from "@tka/types";

export const PI = Math.PI;
export const TWO_PI = 2 * PI;
export const HALF_PI = PI / 2;

export const LOCATION_ANGLES: Record<GridLocation, number> = {
  [GridLocation.EAST]: 0,
  [GridLocation.SOUTH]: HALF_PI,
  [GridLocation.WEST]: PI,
  [GridLocation.NORTH]: -HALF_PI,
  [GridLocation.NORTHEAST]: -HALF_PI / 2,
  [GridLocation.SOUTHEAST]: HALF_PI / 2,
  [GridLocation.SOUTHWEST]: PI - HALF_PI / 2,
  [GridLocation.NORTHWEST]: PI + HALF_PI / 2,
  [GridLocation.CENTER]: 0,
} as const;
