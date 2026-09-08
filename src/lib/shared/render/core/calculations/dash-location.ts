import type { GridLocation, GridMode } from "../types.js";
import {
  PHI_DASH_PSI_DASH_LOCATION_MAP,
  LAMBDA_ZERO_TURNS_LOCATION_MAP,
  DEFAULT_ZERO_TURNS_DASH_LOCATION_MAP,
  NON_ZERO_TURNS_DASH_LOCATION_MAP,
  DIAMOND_DASH_LOCATION_MAP,
  BOX_DASH_LOCATION_MAP,
  PHI_DASH_LETTERS,
  PSI_DASH_LETTERS,
  LAMBDA_LETTERS,
  LAMBDA_DASH_LETTERS,
  TYPE3_LETTERS,
  OPPOSITE_LOCATION_MAP,
} from "../constants/dash-location-maps.js";

export interface DashLocationInput {
  letter: string;
  motionHand: "left" | "right";
  motionStartLocation: string;
  motionEndLocation: string;
  motionTurns: number | "fl" | undefined;
  motionRotationDirection: string;
  otherMotionType?: string;
  otherMotionStartLocation?: string;
  otherMotionEndLocation?: string;
  otherMotionTurns?: number | "fl" | undefined;
  otherMotionRotationDirection?: string;
  gridMode: GridMode;
}

function calculateShiftLocation(startLoc: GridLocation, endLoc: GridLocation): GridLocation | null {
  const createPairKey = (a: GridLocation, b: GridLocation): string => {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  };

  const directionPairs: Record<string, GridLocation> = {
    [createPairKey("n", "e")]: "ne",
    [createPairKey("e", "s")]: "se",
    [createPairKey("s", "w")]: "sw",
    [createPairKey("w", "n")]: "nw",

    [createPairKey("ne", "nw")]: "n",
    [createPairKey("ne", "se")]: "e",
    [createPairKey("sw", "se")]: "s",
    [createPairKey("nw", "sw")]: "w",
  };

  const pairKey = createPairKey(startLoc, endLoc);
  return directionPairs[pairKey] || null;
}

function getOppositeLocation(location: GridLocation): GridLocation {
  return OPPOSITE_LOCATION_MAP[location] || location;
}

function dashLocationNonZeroTurns(startLocation: GridLocation, rotationDirection: string): GridLocation {
  const rotDir = rotationDirection.toLowerCase();
  const isNoRotation = rotDir === "norotation" || rotDir === "none" || rotDir === "no_rotation" || rotDir === "no_rot";

  if (isNoRotation) {
    return startLocation;
  }

  let normalizedDirection: string;
  if (rotDir === "cw" || rotDir === "clockwise") {
    normalizedDirection = "clockwise";
  } else if (rotDir === "ccw" || rotDir === "counter_clockwise" || rotDir === "counterclockwise") {
    normalizedDirection = "counter_clockwise";
  } else {
    normalizedDirection = "clockwise"; 
  }

  const directionMap = NON_ZERO_TURNS_DASH_LOCATION_MAP[normalizedDirection];
  return directionMap?.[startLocation] || startLocation;
}

export function calculateDashLocation(input: DashLocationInput): GridLocation {
  const {
    letter,
    motionHand,
    motionStartLocation,
    motionEndLocation,
    motionTurns,
    motionRotationDirection,
    otherMotionType,
    otherMotionStartLocation,
    otherMotionEndLocation,
    otherMotionTurns,
    otherMotionRotationDirection,
    gridMode,
  } = input;

  const startLoc = motionStartLocation.toLowerCase() as GridLocation;
  const endLoc = motionEndLocation.toLowerCase() as GridLocation;
  const otherEndLoc = otherMotionEndLocation?.toLowerCase() as GridLocation | undefined;
  const turns = typeof motionTurns === "number" ? motionTurns : 0;
  const otherTurns = typeof otherMotionTurns === "number" ? otherMotionTurns : 0;

  if (PHI_DASH_LETTERS.includes(letter) || PSI_DASH_LETTERS.includes(letter)) {
    if (turns === 0 && otherTurns === 0) {
      const key = `${motionHand},${startLoc},${endLoc}`;
      const location = PHI_DASH_PSI_DASH_LOCATION_MAP[key];
      if (location) return location;
    }
    if (turns === 0 && otherTurns !== 0) {
      const otherLocation = dashLocationNonZeroTurns(
        (otherMotionStartLocation?.toLowerCase() || startLoc) as GridLocation,
        otherMotionRotationDirection || "cw"
      );
      return getOppositeLocation(otherLocation);
    }
    if (turns !== 0) {
      return dashLocationNonZeroTurns(startLoc, motionRotationDirection);
    }
  }

  if (LAMBDA_LETTERS.includes(letter) && turns === 0 && otherEndLoc) {
    const key = `${startLoc},${endLoc},${otherEndLoc}`;
    const location = LAMBDA_ZERO_TURNS_LOCATION_MAP[key];
    if (location) return location;
  }

  if (LAMBDA_DASH_LETTERS.includes(letter) && turns === 0 && otherEndLoc) {
    const key = `${startLoc},${endLoc},${otherEndLoc}`;
    const location = LAMBDA_ZERO_TURNS_LOCATION_MAP[key]; 
    if (location) return location;
  }

  if (turns === 0) {
    if (TYPE3_LETTERS.includes(letter)) {
      const isOtherShift =
        otherMotionType?.toLowerCase() === "pro" ||
        otherMotionType?.toLowerCase() === "anti" ||
        otherMotionType?.toLowerCase() === "float";

      if (isOtherShift && otherMotionStartLocation && otherEndLoc) {
        const otherStartLoc = otherMotionStartLocation.toLowerCase() as GridLocation;
        const shiftLocation = calculateShiftLocation(otherStartLoc, otherEndLoc);

        if (shiftLocation) {
          const locationMap = gridMode === "box" ? BOX_DASH_LOCATION_MAP : DIAMOND_DASH_LOCATION_MAP;
          const key = `${startLoc},${shiftLocation}`;
          const location = locationMap[key];
          if (location) return location;
        }
      }
    }

    const key = `${startLoc},${endLoc}`;
    const location = DEFAULT_ZERO_TURNS_DASH_LOCATION_MAP[key];
    if (location) return location;
  }

  return dashLocationNonZeroTurns(startLoc, motionRotationDirection);
}
