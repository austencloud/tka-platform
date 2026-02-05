import type { GridLocation } from "@tka/types";
import {
  allClockwisePairs,
  allCounterClockwisePairs,
} from "../../../../constants/arrow/HandpathDirectionMaps";
import type {
  HandpathDirection,
  IHandpathDirectionCalculator,
} from "../contracts/IHandpathDirectionCalculator";

/**
 * Determines the direction of hand movement based on start and end grid locations.
 * Uses predefined location pair maps to identify clockwise vs counter-clockwise movement.
 */
export class HandpathDirectionCalculator
  implements IHandpathDirectionCalculator
{
  calculateDirection(
    startLocation: GridLocation,
    endLocation: GridLocation
  ): HandpathDirection {
    if (startLocation === endLocation) {
      return "static";
    }

    for (const [start, end] of allClockwisePairs) {
      if (startLocation === start && endLocation === end) {
        return "cw";
      }
    }

    for (const [start, end] of allCounterClockwisePairs) {
      if (startLocation === start && endLocation === end) {
        return "ccw";
      }
    }

    return "dash";
  }
}
