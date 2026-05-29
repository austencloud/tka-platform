/**
 * Handpath Direction Calculator
 *
 * Determines the direction of hand movement based on start and end grid locations.
 * Uses predefined location pair maps to identify clockwise vs counter-clockwise movement.
 *
 * Matches legacy HandpathCalculator logic.
 */

import type { GridLocation } from "../../../../grid/domain/enums/grid-enums";
import {
  allClockwisePairs,
  allCounterClockwisePairs,
} from "../config/HandpathDirectionMaps";
import type { HandpathDirection } from "./types";

export function calculateHandpathDirection(
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
