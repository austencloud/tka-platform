/**
 * Shift Location Calculator
 *
 * Handles location calculation for pro, anti, and float motions.
 * Based on the legacy desktop ShiftLocationCalculator.
 */

import type { MotionData } from "../../../../../shared/domain/models/MotionData";
import { GridLocation } from "../../../../../grid/domain/enums/grid-enums";
import type { IShiftLocationCalculator } from "../contracts/IShiftLocationCalculator";

export class ShiftLocationCalculator implements IShiftLocationCalculator {
  calculateLocation(motion: MotionData): GridLocation {
    const startLocation = motion.startLocation;
    const endLocation = motion.endLocation;

    if (!startLocation || !endLocation) {
      console.warn("Missing startLocation or endLocation for shift motion");
      return GridLocation.NORTHEAST;
    }

    // Direction pairs mapping using GridLocation enum values
    const directionPairs: Record<string, GridLocation> = {
      // Diamond combinations (cardinal to cardinal)
      [this.createPairKey(GridLocation.NORTH, GridLocation.EAST)]:
        GridLocation.NORTHEAST,
      [this.createPairKey(GridLocation.EAST, GridLocation.SOUTH)]:
        GridLocation.SOUTHEAST,
      [this.createPairKey(GridLocation.SOUTH, GridLocation.WEST)]:
        GridLocation.SOUTHWEST,
      [this.createPairKey(GridLocation.WEST, GridLocation.NORTH)]:
        GridLocation.NORTHWEST,

      // Box combinations (diagonal to diagonal -> cardinal)
      [this.createPairKey(GridLocation.NORTHEAST, GridLocation.NORTHWEST)]:
        GridLocation.NORTH,
      [this.createPairKey(GridLocation.NORTHEAST, GridLocation.SOUTHEAST)]:
        GridLocation.EAST,
      [this.createPairKey(GridLocation.SOUTHWEST, GridLocation.SOUTHEAST)]:
        GridLocation.SOUTH,
      [this.createPairKey(GridLocation.NORTHWEST, GridLocation.SOUTHWEST)]:
        GridLocation.WEST,
    };

    const pairKey = this.createPairKey(startLocation, endLocation);
    const location = directionPairs[pairKey];

    if (!location) {
      console.warn(
        `Unknown direction pair: ${startLocation} -> ${endLocation}`
      );
      return GridLocation.NORTH; // Default to north
    }

    return location;
  }

  /**
   * Create a stable key for unordered GridLocation pairs.
   * Ensures (a,b) and (b,a) resolve to the same lookup string.
   */
  private createPairKey(first: GridLocation, second: GridLocation): string {
    if (first === second) {
      return `${first}|${second}`;
    }

    return first < second ? `${first}|${second}` : `${second}|${first}`;
  }
}
