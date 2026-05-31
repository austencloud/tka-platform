/**
 * Shift Location Calculator
 *
 * Handles location calculation for pro, anti, and float motions.
 * Based on the legacy desktop ShiftLocationCalculator.
 */

import type { MotionData } from "../../../../shared/domain/models/motion-data";
import { GridLocation } from "../../../../grid/domain/enums/grid-enums";

function createPairKey(first: GridLocation, second: GridLocation): string {
  if (first === second) {
    return `${first}|${second}`;
  }
  return first < second ? `${first}|${second}` : `${second}|${first}`;
}

export function calculateShiftLocation(motion: MotionData): GridLocation {
  const startLocation = motion.startLocation;
  const endLocation = motion.endLocation;

  if (!startLocation || !endLocation) {
    console.warn("Missing startLocation or endLocation for shift motion");
    return GridLocation.NORTHEAST;
  }

  const directionPairs: Record<string, GridLocation> = {
    [createPairKey(GridLocation.NORTH, GridLocation.EAST)]: GridLocation.NORTHEAST,
    [createPairKey(GridLocation.EAST, GridLocation.SOUTH)]: GridLocation.SOUTHEAST,
    [createPairKey(GridLocation.SOUTH, GridLocation.WEST)]: GridLocation.SOUTHWEST,
    [createPairKey(GridLocation.WEST, GridLocation.NORTH)]: GridLocation.NORTHWEST,

    [createPairKey(GridLocation.NORTHEAST, GridLocation.NORTHWEST)]: GridLocation.NORTH,
    [createPairKey(GridLocation.NORTHEAST, GridLocation.SOUTHEAST)]: GridLocation.EAST,
    [createPairKey(GridLocation.SOUTHWEST, GridLocation.SOUTHEAST)]: GridLocation.SOUTH,
    [createPairKey(GridLocation.NORTHWEST, GridLocation.SOUTHWEST)]: GridLocation.WEST,
  };

  const pairKey = createPairKey(startLocation, endLocation);
  const location = directionPairs[pairKey];

  if (!location) {
    console.warn(`Unknown direction pair: ${startLocation} -> ${endLocation}`);
    return GridLocation.NORTH;
  }

  return location;
}
