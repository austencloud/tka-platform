import { GridLocation } from "../../../../grid/domain/enums/grid-enums.ts";

/**
 * FLOAT arrow rotation maps.
 *
 * IMPORTANT: Float rotation is based on HANDPATH DIRECTION, not prop rotation direction!
 * Handpath direction is determined by the motion from start location to end location.
 *
 * Clockwise handpath: S→W, W→N, N→E, E→S, NE→SE, SE→SW, SW→NW, NW→NE
 * Counter-clockwise handpath: W→S, N→W, E→N, S→E, NE→NW, NW→SW, SW→SE, SE→NE
 */

export const floatClockwiseHandpathMap: Record<GridLocation, number> = {
  [GridLocation.NORTH]: 315,
  [GridLocation.EAST]: 45,
  [GridLocation.SOUTH]: 135,
  [GridLocation.WEST]: 225,
  [GridLocation.NORTHEAST]: 0,
  [GridLocation.SOUTHEAST]: 90,
  [GridLocation.SOUTHWEST]: 180,
  [GridLocation.NORTHWEST]: 270,
};

export const floatCounterClockwiseHandpathMap: Record<GridLocation, number> = {
  [GridLocation.NORTH]: 135,
  [GridLocation.EAST]: 225,
  [GridLocation.SOUTH]: 315,
  [GridLocation.WEST]: 45,
  [GridLocation.NORTHEAST]: 180,
  [GridLocation.SOUTHEAST]: 270,
  [GridLocation.SOUTHWEST]: 0,
  [GridLocation.NORTHWEST]: 90,
};
