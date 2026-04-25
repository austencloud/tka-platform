import type { GridLocation } from "../../../../../grid/domain/enums/grid-enums";
import {
  allClockwisePairs,
  allCounterClockwisePairs,
} from "../../config/HandpathDirectionMaps";
import type {
  HandpathDirection,
  IHandpathDirectionCalculator,
} from "../contracts/IHandpathDirectionCalculator";

/**
 * Implementation of handpath direction calculator.
 *
 * Determines the direction of hand movement based on start and end grid locations.
 * Uses predefined location pair maps to identify clockwise vs counter-clockwise movement.
 *
 * Matches legacy HandpathCalculator logic.
 */
export class HandpathDirectionCalculator implements IHandpathDirectionCalculator {
  calculateDirection(
    startLocation: GridLocation,
    endLocation: GridLocation
  ): HandpathDirection {
    // Check if static (same location)
    if (startLocation === endLocation) {
      return "static";
    }

    // Check clockwise pairs
    for (const [start, end] of allClockwisePairs) {
      if (startLocation === start && endLocation === end) {
        return "cw";
      }
    }

    // Check counter-clockwise pairs
    for (const [start, end] of allCounterClockwisePairs) {
      if (startLocation === start && endLocation === end) {
        return "ccw";
      }
    }

    // Otherwise it's a dash movement (straight line across grid)
    return "dash";
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
// Use this instead of handpathDirectionCalculator to avoid DI container rebuilds.
// ============================================================================

export const handpathDirectionCalculator = new HandpathDirectionCalculator();
