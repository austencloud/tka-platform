/**
 * Static Location Calculator
 *
 * Handles location calculation for static motions.
 * Based on the legacy desktop StaticLocationCalculator.
 */

import { GridLocation } from "../../../../../grid/domain/enums/grid-enums";
import type { MotionData } from "../../../../../shared/domain/models/MotionData";
export class StaticLocationCalculator {
  calculateLocation(motion: MotionData): GridLocation {
    // Static motions typically stay at their original location
    const startLocation = motion.startLocation;

    if (!startLocation) {
      console.warn("Missing startLocation for static motion");
      return GridLocation.NORTH; // Default to north
    }

    // Map GridLocation enum values directly - no string conversion needed
    const locationMap: Record<GridLocation, GridLocation> = {
      [GridLocation.NORTH]: GridLocation.NORTH,
      [GridLocation.NORTHEAST]: GridLocation.NORTHEAST,
      [GridLocation.EAST]: GridLocation.EAST,
      [GridLocation.SOUTHEAST]: GridLocation.SOUTHEAST,
      [GridLocation.SOUTH]: GridLocation.SOUTH,
      [GridLocation.SOUTHWEST]: GridLocation.SOUTHWEST,
      [GridLocation.WEST]: GridLocation.WEST,
      [GridLocation.NORTHWEST]: GridLocation.NORTHWEST,
      [GridLocation.CENTER]: GridLocation.CENTER,
    };

    const mappedLocation = locationMap[startLocation];

    if (!mappedLocation) {
      console.warn(`Unknown static location: ${startLocation}`);
      return GridLocation.NORTH; // Default to north
    }

    return mappedLocation;
  }
}
