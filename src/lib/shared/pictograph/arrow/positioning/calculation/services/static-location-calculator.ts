/**
 * Static Location Calculator
 *
 * Handles location calculation for static motions.
 * Based on the legacy desktop StaticLocationCalculator.
 */

import { GridLocation } from "../../../../grid/domain/enums/grid-enums";
import type { MotionData } from "../../../../shared/domain/models/motion-data";

export function calculateStaticLocation(motion: MotionData): GridLocation {
  const startLocation = motion.startLocation;

  if (!startLocation) {
    console.warn("Missing startLocation for static motion");
    return GridLocation.NORTH;
  }

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
    return GridLocation.NORTH;
  }

  return mappedLocation;
}
