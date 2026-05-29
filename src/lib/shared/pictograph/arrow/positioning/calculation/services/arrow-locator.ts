/**
 * Arrow Location Service
 *
 * Determines arrow location based on start and end positions using the same logic
 * as the desktop app's ShiftLocationCalculator.
 */
import type { ArrowLocationInput } from "./types";

export function calculateArrowLocation(input: ArrowLocationInput): string {
  const { startLocation, endLocation, motionType } = input;

  if (!startLocation || !endLocation) {
    return "";
  }

  if (["pro", "anti", "float"].includes(motionType)) {
    return calculateShiftLocation(startLocation, endLocation);
  }

  return startLocation;
}

function calculateShiftLocation(
  startLocation: string,
  endLocation: string
): string {
  const directionPairs: Record<string, string> = {
    "n,e": "ne",
    "e,n": "ne",
    "e,s": "se",
    "s,e": "se",
    "s,w": "sw",
    "w,s": "sw",
    "w,n": "nw",
    "n,w": "nw",

    "ne,nw": "n",
    "nw,ne": "n",
    "ne,se": "e",
    "se,ne": "e",
    "sw,se": "s",
    "se,sw": "s",
    "nw,sw": "w",
    "sw,nw": "w",
  };

  const key1 = `${startLocation},${endLocation}`;
  const key2 = `${endLocation},${startLocation}`;

  return directionPairs[key1] || directionPairs[key2] || "";
}

export const LOCATIONS = {
  NORTH: "n",
  EAST: "e",
  SOUTH: "s",
  WEST: "w",
  NORTHEAST: "ne",
  SOUTHEAST: "se",
  SOUTHWEST: "sw",
  NORTHWEST: "nw",
} as const;

export const MOTION_TYPES = {
  PRO: "pro",
  ANTI: "anti",
  FLOAT: "float",
  DASH: "dash",
  STATIC: "static",
} as const;
