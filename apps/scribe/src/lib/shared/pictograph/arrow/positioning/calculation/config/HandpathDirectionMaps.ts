import { GridLocation } from "../../../../grid/domain/enums/grid-enums.ts";

/**
 * Handpath direction configuration maps.
 *
 * These maps define location pairs that determine handpath direction
 * for FLOAT arrow rotation calculations.
 *
 * Handpath direction is determined by the motion from start location to end location,
 * independent of prop rotation direction.
 */

export type LocationPair = [GridLocation, GridLocation];

/**
 * Clockwise handpath movements (cardinal directions)
 * S→W, W→N, N→E, E→S
 */
export const clockwiseCardinalPairs: LocationPair[] = [
  [GridLocation.SOUTH, GridLocation.WEST],
  [GridLocation.WEST, GridLocation.NORTH],
  [GridLocation.NORTH, GridLocation.EAST],
  [GridLocation.EAST, GridLocation.SOUTH],
];

/**
 * Counter-clockwise handpath movements (cardinal directions)
 * W→S, N→W, E→N, S→E
 */
export const counterClockwiseCardinalPairs: LocationPair[] = [
  [GridLocation.WEST, GridLocation.SOUTH],
  [GridLocation.NORTH, GridLocation.WEST],
  [GridLocation.EAST, GridLocation.NORTH],
  [GridLocation.SOUTH, GridLocation.EAST],
];

/**
 * Clockwise handpath movements (diagonal directions)
 * NE→SE, SE→SW, SW→NW, NW→NE
 */
export const clockwiseDiagonalPairs: LocationPair[] = [
  [GridLocation.NORTHEAST, GridLocation.SOUTHEAST],
  [GridLocation.SOUTHEAST, GridLocation.SOUTHWEST],
  [GridLocation.SOUTHWEST, GridLocation.NORTHWEST],
  [GridLocation.NORTHWEST, GridLocation.NORTHEAST],
];

/**
 * Counter-clockwise handpath movements (diagonal directions)
 * NE→NW, NW→SW, SW→SE, SE→NE
 */
export const counterClockwiseDiagonalPairs: LocationPair[] = [
  [GridLocation.NORTHEAST, GridLocation.NORTHWEST],
  [GridLocation.NORTHWEST, GridLocation.SOUTHWEST],
  [GridLocation.SOUTHWEST, GridLocation.SOUTHEAST],
  [GridLocation.SOUTHEAST, GridLocation.NORTHEAST],
];

/**
 * All clockwise handpath pairs (cardinal + diagonal)
 */
export const allClockwisePairs: LocationPair[] = [
  ...clockwiseCardinalPairs,
  ...clockwiseDiagonalPairs,
];

/**
 * All counter-clockwise handpath pairs (cardinal + diagonal)
 */
export const allCounterClockwisePairs: LocationPair[] = [
  ...counterClockwiseCardinalPairs,
  ...counterClockwiseDiagonalPairs,
];
