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
 * DASH rotation override maps. A DASH override quarter-turns the glyph; it
 * cannot reuse the STATIC override maps because those turn it by 180 degrees.
 *
 * The two maps are MIRROR IMAGES, not independent tables. A counter-clockwise
 * DASH arrow renders with `scale(-1, 1)` (shouldMirrorArrow in
 * arrow-positioning-orchestrator), and a horizontal flip reverses rotational
 * sense, so for every location:
 *
 *   ccw[loc] === (360 - cw[mirrorAcrossVerticalAxis(loc)]) % 360
 *
 * The normal dashClockwiseMap/dashCounterClockwiseMap pair above already
 * satisfies that identity. The counter-clockwise override table did not: it
 * was transcribed with its NORTH/SOUTH and NE/SE, NW/SW keys swapped, which
 * quarter-turned the glyph the wrong way at six of the eight locations (and
 * not at all at SE and NW). Symptom: on a 1-turn CCW dash at NORTH the glyph
 * points down, and pressing X swung it right instead of left.
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
  [GridLocation.NORTH]: 90,
  [GridLocation.EAST]: 180,
  [GridLocation.SOUTH]: 270,
  [GridLocation.WEST]: 0,
  [GridLocation.NORTHEAST]: 135,
  [GridLocation.SOUTHEAST]: 225,
  [GridLocation.SOUTHWEST]: 315,
  [GridLocation.NORTHWEST]: 45,
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
