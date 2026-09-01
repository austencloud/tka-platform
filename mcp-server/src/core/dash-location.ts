/**
 * Dash Location Calculator for Standalone Renderer
 *
 * Ported from src/lib/shared/pictograph/arrow/positioning/calculation/services/implementations/DashLocationCalculator.ts
 *
 * Dash arrows are NOT placed at their start or end locations.
 * Instead, their location is calculated based on the motion parameters.
 */

import { GridLocation, GridMode } from "./enums.js";
import type { HandSide } from "@tka/tka-types";

// Input for dash location calculation
export interface DashLocationInput {
  letter: string;
  motionHand: HandSide;
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

/**
 * Calculate shift arrow location (midpoint between start and end).
 * This is where pro/anti/float arrows are positioned.
 */
function calculateShiftLocation(startLoc: GridLocation, endLoc: GridLocation): GridLocation | null {
  // Create stable key (sorted) for unordered pair lookup
  const createPairKey = (a: GridLocation, b: GridLocation): string => {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  };

  const directionPairs: Record<string, GridLocation> = {
    // Diamond combinations (cardinal to cardinal)
    [createPairKey(GridLocation.NORTH, GridLocation.EAST)]: GridLocation.NORTHEAST,
    [createPairKey(GridLocation.EAST, GridLocation.SOUTH)]: GridLocation.SOUTHEAST,
    [createPairKey(GridLocation.SOUTH, GridLocation.WEST)]: GridLocation.SOUTHWEST,
    [createPairKey(GridLocation.WEST, GridLocation.NORTH)]: GridLocation.NORTHWEST,

    // Box combinations (diagonal to diagonal -> cardinal)
    [createPairKey(GridLocation.NORTHEAST, GridLocation.NORTHWEST)]: GridLocation.NORTH,
    [createPairKey(GridLocation.NORTHEAST, GridLocation.SOUTHEAST)]: GridLocation.EAST,
    [createPairKey(GridLocation.SOUTHWEST, GridLocation.SOUTHEAST)]: GridLocation.SOUTH,
    [createPairKey(GridLocation.NORTHWEST, GridLocation.SOUTHWEST)]: GridLocation.WEST,
  };

  const pairKey = createPairKey(startLoc, endLoc);
  return directionPairs[pairKey] || null;
}

// Φ_DASH and Ψ_DASH special handling map
const PHI_DASH_PSI_DASH_LOCATION_MAP: Record<string, GridLocation> = {
  [`right,${GridLocation.NORTH},${GridLocation.SOUTH}`]: GridLocation.EAST,
  [`right,${GridLocation.EAST},${GridLocation.WEST}`]: GridLocation.NORTH,
  [`right,${GridLocation.SOUTH},${GridLocation.NORTH}`]: GridLocation.EAST,
  [`right,${GridLocation.WEST},${GridLocation.EAST}`]: GridLocation.NORTH,
  [`left,${GridLocation.NORTH},${GridLocation.SOUTH}`]: GridLocation.WEST,
  [`left,${GridLocation.EAST},${GridLocation.WEST}`]: GridLocation.SOUTH,
  [`left,${GridLocation.SOUTH},${GridLocation.NORTH}`]: GridLocation.WEST,
  [`left,${GridLocation.WEST},${GridLocation.EAST}`]: GridLocation.SOUTH,
  [`right,${GridLocation.NORTHWEST},${GridLocation.SOUTHEAST}`]: GridLocation.NORTHEAST,
  [`right,${GridLocation.NORTHEAST},${GridLocation.SOUTHWEST}`]: GridLocation.SOUTHEAST,
  [`right,${GridLocation.SOUTHWEST},${GridLocation.NORTHEAST}`]: GridLocation.SOUTHEAST,
  [`right,${GridLocation.SOUTHEAST},${GridLocation.NORTHWEST}`]: GridLocation.NORTHEAST,
  [`left,${GridLocation.NORTHWEST},${GridLocation.SOUTHEAST}`]: GridLocation.SOUTHWEST,
  [`left,${GridLocation.NORTHEAST},${GridLocation.SOUTHWEST}`]: GridLocation.NORTHWEST,
  [`left,${GridLocation.SOUTHWEST},${GridLocation.NORTHEAST}`]: GridLocation.NORTHWEST,
  [`left,${GridLocation.SOUTHEAST},${GridLocation.NORTHWEST}`]: GridLocation.SOUTHWEST,
};

// Lambda zero turns special case
const LAMBDA_ZERO_TURNS_LOCATION_MAP: Record<string, GridLocation> = {
  [`${GridLocation.NORTH},${GridLocation.SOUTH},${GridLocation.WEST}`]: GridLocation.EAST,
  [`${GridLocation.EAST},${GridLocation.WEST},${GridLocation.SOUTH}`]: GridLocation.NORTH,
  [`${GridLocation.NORTH},${GridLocation.SOUTH},${GridLocation.EAST}`]: GridLocation.WEST,
  [`${GridLocation.WEST},${GridLocation.EAST},${GridLocation.SOUTH}`]: GridLocation.NORTH,
  [`${GridLocation.SOUTH},${GridLocation.NORTH},${GridLocation.WEST}`]: GridLocation.EAST,
  [`${GridLocation.EAST},${GridLocation.WEST},${GridLocation.NORTH}`]: GridLocation.SOUTH,
  [`${GridLocation.SOUTH},${GridLocation.NORTH},${GridLocation.EAST}`]: GridLocation.WEST,
  [`${GridLocation.WEST},${GridLocation.EAST},${GridLocation.NORTH}`]: GridLocation.SOUTH,
  [`${GridLocation.NORTHEAST},${GridLocation.SOUTHWEST},${GridLocation.NORTHWEST}`]: GridLocation.SOUTHEAST,
  [`${GridLocation.NORTHWEST},${GridLocation.SOUTHEAST},${GridLocation.NORTHEAST}`]: GridLocation.SOUTHWEST,
  [`${GridLocation.SOUTHWEST},${GridLocation.NORTHEAST},${GridLocation.SOUTHEAST}`]: GridLocation.NORTHWEST,
  [`${GridLocation.SOUTHEAST},${GridLocation.NORTHWEST},${GridLocation.SOUTHWEST}`]: GridLocation.NORTHEAST,
  [`${GridLocation.NORTHEAST},${GridLocation.SOUTHWEST},${GridLocation.SOUTHEAST}`]: GridLocation.NORTHWEST,
  [`${GridLocation.NORTHWEST},${GridLocation.SOUTHEAST},${GridLocation.SOUTHWEST}`]: GridLocation.NORTHEAST,
  [`${GridLocation.SOUTHWEST},${GridLocation.NORTHEAST},${GridLocation.NORTHWEST}`]: GridLocation.SOUTHEAST,
  [`${GridLocation.SOUTHEAST},${GridLocation.NORTHWEST},${GridLocation.NORTHEAST}`]: GridLocation.SOUTHWEST,
};

// Default zero turns dash location map
const DEFAULT_ZERO_TURNS_DASH_LOCATION_MAP: Record<string, GridLocation> = {
  [`${GridLocation.NORTH},${GridLocation.SOUTH}`]: GridLocation.EAST,
  [`${GridLocation.EAST},${GridLocation.WEST}`]: GridLocation.SOUTH,
  [`${GridLocation.SOUTH},${GridLocation.NORTH}`]: GridLocation.WEST,
  [`${GridLocation.WEST},${GridLocation.EAST}`]: GridLocation.NORTH,
  [`${GridLocation.NORTHEAST},${GridLocation.SOUTHWEST}`]: GridLocation.SOUTHEAST,
  [`${GridLocation.NORTHWEST},${GridLocation.SOUTHEAST}`]: GridLocation.NORTHEAST,
  [`${GridLocation.SOUTHWEST},${GridLocation.NORTHEAST}`]: GridLocation.NORTHWEST,
  [`${GridLocation.SOUTHEAST},${GridLocation.NORTHWEST}`]: GridLocation.SOUTHWEST,
};

// Non-zero turns dash location map (rotation-based)
const NON_ZERO_TURNS_DASH_LOCATION_MAP: Record<string, Record<GridLocation, GridLocation>> = {
  clockwise: {
    [GridLocation.NORTH]: GridLocation.EAST,
    [GridLocation.EAST]: GridLocation.SOUTH,
    [GridLocation.SOUTH]: GridLocation.WEST,
    [GridLocation.WEST]: GridLocation.NORTH,
    [GridLocation.NORTHEAST]: GridLocation.SOUTHEAST,
    [GridLocation.SOUTHEAST]: GridLocation.SOUTHWEST,
    [GridLocation.SOUTHWEST]: GridLocation.NORTHWEST,
    [GridLocation.NORTHWEST]: GridLocation.NORTHEAST,
  } as Record<GridLocation, GridLocation>,
  counter_clockwise: {
    [GridLocation.NORTH]: GridLocation.WEST,
    [GridLocation.EAST]: GridLocation.NORTH,
    [GridLocation.SOUTH]: GridLocation.EAST,
    [GridLocation.WEST]: GridLocation.SOUTH,
    [GridLocation.NORTHEAST]: GridLocation.NORTHWEST,
    [GridLocation.SOUTHEAST]: GridLocation.NORTHEAST,
    [GridLocation.SOUTHWEST]: GridLocation.SOUTHEAST,
    [GridLocation.NORTHWEST]: GridLocation.SOUTHWEST,
  } as Record<GridLocation, GridLocation>,
};

// Diamond mode Type3 dash location map
const DIAMOND_DASH_LOCATION_MAP: Record<string, GridLocation> = {
  [`${GridLocation.NORTH},${GridLocation.NORTHWEST}`]: GridLocation.EAST,
  [`${GridLocation.NORTH},${GridLocation.NORTHEAST}`]: GridLocation.WEST,
  [`${GridLocation.NORTH},${GridLocation.SOUTHEAST}`]: GridLocation.WEST,
  [`${GridLocation.NORTH},${GridLocation.SOUTHWEST}`]: GridLocation.EAST,
  [`${GridLocation.EAST},${GridLocation.NORTHWEST}`]: GridLocation.SOUTH,
  [`${GridLocation.EAST},${GridLocation.NORTHEAST}`]: GridLocation.SOUTH,
  [`${GridLocation.EAST},${GridLocation.SOUTHEAST}`]: GridLocation.NORTH,
  [`${GridLocation.EAST},${GridLocation.SOUTHWEST}`]: GridLocation.NORTH,
  [`${GridLocation.SOUTH},${GridLocation.NORTHWEST}`]: GridLocation.EAST,
  [`${GridLocation.SOUTH},${GridLocation.NORTHEAST}`]: GridLocation.WEST,
  [`${GridLocation.SOUTH},${GridLocation.SOUTHEAST}`]: GridLocation.WEST,
  [`${GridLocation.SOUTH},${GridLocation.SOUTHWEST}`]: GridLocation.EAST,
  [`${GridLocation.WEST},${GridLocation.NORTHWEST}`]: GridLocation.SOUTH,
  [`${GridLocation.WEST},${GridLocation.NORTHEAST}`]: GridLocation.SOUTH,
  [`${GridLocation.WEST},${GridLocation.SOUTHEAST}`]: GridLocation.NORTH,
  [`${GridLocation.WEST},${GridLocation.SOUTHWEST}`]: GridLocation.NORTH,
};

// Box mode Type3 dash location map
const BOX_DASH_LOCATION_MAP: Record<string, GridLocation> = {
  [`${GridLocation.NORTHEAST},${GridLocation.NORTH}`]: GridLocation.SOUTHEAST,
  [`${GridLocation.NORTHEAST},${GridLocation.EAST}`]: GridLocation.NORTHWEST,
  [`${GridLocation.NORTHEAST},${GridLocation.SOUTH}`]: GridLocation.NORTHWEST,
  [`${GridLocation.NORTHEAST},${GridLocation.WEST}`]: GridLocation.SOUTHEAST,
  [`${GridLocation.SOUTHEAST},${GridLocation.NORTH}`]: GridLocation.SOUTHWEST,
  [`${GridLocation.SOUTHEAST},${GridLocation.EAST}`]: GridLocation.SOUTHWEST,
  [`${GridLocation.SOUTHEAST},${GridLocation.SOUTH}`]: GridLocation.NORTHEAST,
  [`${GridLocation.SOUTHEAST},${GridLocation.WEST}`]: GridLocation.NORTHEAST,
  [`${GridLocation.SOUTHWEST},${GridLocation.NORTH}`]: GridLocation.SOUTHEAST,
  [`${GridLocation.SOUTHWEST},${GridLocation.EAST}`]: GridLocation.NORTHWEST,
  [`${GridLocation.SOUTHWEST},${GridLocation.SOUTH}`]: GridLocation.NORTHWEST,
  [`${GridLocation.SOUTHWEST},${GridLocation.WEST}`]: GridLocation.SOUTHEAST,
  [`${GridLocation.NORTHWEST},${GridLocation.NORTH}`]: GridLocation.SOUTHWEST,
  [`${GridLocation.NORTHWEST},${GridLocation.EAST}`]: GridLocation.SOUTHWEST,
  [`${GridLocation.NORTHWEST},${GridLocation.SOUTH}`]: GridLocation.NORTHEAST,
  [`${GridLocation.NORTHWEST},${GridLocation.WEST}`]: GridLocation.NORTHEAST,
};

// Letters that need special handling
const PHI_DASH_LETTERS = ["Φ-"];
const PSI_DASH_LETTERS = ["Ψ-"];
const LAMBDA_LETTERS = ["Λ"];
const LAMBDA_DASH_LETTERS = ["Λ-"];
const TYPE3_LETTERS = ["W-", "X-", "Y-", "Z-", "Σ-", "Δ-", "Θ-", "Ω-"];

/**
 * Calculate the location where a dash arrow should be placed.
 * This is NOT the same as start or end location.
 */
export function calculateDashLocation(input: DashLocationInput): GridLocation {
  const {
    letter,
    motionHand,
    motionStartLocation,
    motionEndLocation,
    motionTurns,
    motionRotationDirection,
    otherMotionEndLocation,
    otherMotionTurns,
    gridMode,
  } = input;

  const startLoc = motionStartLocation.toLowerCase() as GridLocation;
  const endLoc = motionEndLocation.toLowerCase() as GridLocation;
  const otherEndLoc = otherMotionEndLocation?.toLowerCase() as GridLocation | undefined;
  const turns = typeof motionTurns === "number" ? motionTurns : 0;
  const otherTurns = typeof otherMotionTurns === "number" ? otherMotionTurns : 0;

  // Φ_DASH and Ψ_DASH special handling
  if (PHI_DASH_LETTERS.includes(letter) || PSI_DASH_LETTERS.includes(letter)) {
    // Both motions have zero turns
    if (turns === 0 && otherTurns === 0) {
      const key = `${motionHand},${startLoc},${endLoc}`;
      const location = PHI_DASH_PSI_DASH_LOCATION_MAP[key];
      if (location) return location;
    }
    // Current motion has zero turns, other doesn't - use opposite of other
    if (turns === 0 && otherTurns !== 0) {
      const otherLocation = dashLocationNonZeroTurns(
        input.otherMotionStartLocation?.toLowerCase() as GridLocation,
        input.otherMotionRotationDirection || "cw"
      );
      return getOppositeLocation(otherLocation);
    }
    // Current motion has non-zero turns
    if (turns !== 0) {
      return dashLocationNonZeroTurns(startLoc, motionRotationDirection);
    }
  }

  // Lambda zero turns special case
  if (LAMBDA_LETTERS.includes(letter) && turns === 0 && otherEndLoc) {
    const key = `${startLoc},${endLoc},${otherEndLoc}`;
    const location = LAMBDA_ZERO_TURNS_LOCATION_MAP[key];
    if (location) return location;
  }

  // Lambda-Dash zero turns special case
  if (LAMBDA_DASH_LETTERS.includes(letter) && turns === 0 && otherEndLoc) {
    const key = `${startLoc},${endLoc},${otherEndLoc}`;
    const location = LAMBDA_ZERO_TURNS_LOCATION_MAP[key]; // Uses same map
    if (location) return location;
  }

  // Zero turns - check for Type 3 or default
  if (turns === 0) {
    // Type 3 scenario - dash location depends on the shift arrow location
    if (TYPE3_LETTERS.includes(letter)) {
      // For Type 3, we need to calculate the SHIFT ARROW LOCATION of the other motion
      // The shift location is the midpoint between the other motion's start and end
      const otherMotionType = input.otherMotionType?.toLowerCase();
      const isOtherShift = otherMotionType === "pro" || otherMotionType === "anti" || otherMotionType === "float";

      if (isOtherShift && input.otherMotionStartLocation && otherEndLoc) {
        const otherStartLoc = input.otherMotionStartLocation.toLowerCase() as GridLocation;
        const shiftLocation = calculateShiftLocation(otherStartLoc, otherEndLoc);

        if (shiftLocation) {
          const locationMap = gridMode === GridMode.BOX ? BOX_DASH_LOCATION_MAP : DIAMOND_DASH_LOCATION_MAP;
          const key = `${startLoc},${shiftLocation}`;
          const location = locationMap[key];
          if (location) return location;
        }
      }
    }

    // Default zero turns mapping
    const key = `${startLoc},${endLoc}`;
    const location = DEFAULT_ZERO_TURNS_DASH_LOCATION_MAP[key];
    if (location) return location;
  }

  // Non-zero turns - rotation based
  return dashLocationNonZeroTurns(startLoc, motionRotationDirection);
}

/**
 * Calculate dash location for non-zero turns based on rotation direction.
 */
function dashLocationNonZeroTurns(startLocation: GridLocation, rotationDirection: string): GridLocation {
  const rotDir = rotationDirection.toLowerCase();
  const isNoRotation = rotDir === "norotation" || rotDir === "none" || rotDir === "no_rotation";

  if (isNoRotation) {
    return startLocation;
  }

  // Normalize rotation direction to map keys
  let normalizedDirection: string;
  if (rotDir === "cw" || rotDir === "clockwise") {
    normalizedDirection = "clockwise";
  } else if (rotDir === "ccw" || rotDir === "counter_clockwise" || rotDir === "counterclockwise") {
    normalizedDirection = "counter_clockwise";
  } else {
    normalizedDirection = "clockwise"; // Default
  }

  const directionMap = NON_ZERO_TURNS_DASH_LOCATION_MAP[normalizedDirection];
  return directionMap?.[startLocation] || startLocation;
}

/**
 * Get the opposite location on the grid.
 */
function getOppositeLocation(location: GridLocation): GridLocation {
  const oppositeMap: Record<GridLocation, GridLocation> = {
    [GridLocation.NORTH]: GridLocation.SOUTH,
    [GridLocation.SOUTH]: GridLocation.NORTH,
    [GridLocation.EAST]: GridLocation.WEST,
    [GridLocation.WEST]: GridLocation.EAST,
    [GridLocation.NORTHEAST]: GridLocation.SOUTHWEST,
    [GridLocation.SOUTHWEST]: GridLocation.NORTHEAST,
    [GridLocation.SOUTHEAST]: GridLocation.NORTHWEST,
    [GridLocation.NORTHWEST]: GridLocation.SOUTHEAST,
  } as Record<GridLocation, GridLocation>;
  return oppositeMap[location] || location;
}
