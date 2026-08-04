/**
 * Prop placement calculations for pictograph rendering
 * Ported from src/lib/shared/pictograph/prop for Node.js usage
 *
 * Handles prop position and rotation angle calculations using pure lookup tables.
 */

import {
  GridLocation,
  GridMode,
  Orientation,
  CARDINAL_LOCATIONS,
} from "./enums.js";
import { getHandPointCoordinates, type Coordinates } from "./grid-coordinates.js";

// ============================================================================
// PROP ROTATION ANGLE MAPS
// ============================================================================

/**
 * Diamond grid rotation angles by orientation and location
 * These are the exact values from PropRotAngleManager.ts
 */
const DIAMOND_ANGLE_MAP: Record<Orientation, Record<GridLocation, number>> = {
  [Orientation.IN]: {
    [GridLocation.NORTH]: 90,
    [GridLocation.SOUTH]: 270,
    [GridLocation.WEST]: 0,
    [GridLocation.EAST]: 180,
    [GridLocation.NORTHEAST]: 0,
    [GridLocation.SOUTHEAST]: 0,
    [GridLocation.SOUTHWEST]: 0,
    [GridLocation.NORTHWEST]: 0,
  },
  [Orientation.OUT]: {
    [GridLocation.NORTH]: 270,
    [GridLocation.SOUTH]: 90,
    [GridLocation.WEST]: 180,
    [GridLocation.EAST]: 0,
    [GridLocation.NORTHEAST]: 0,
    [GridLocation.SOUTHEAST]: 0,
    [GridLocation.SOUTHWEST]: 0,
    [GridLocation.NORTHWEST]: 0,
  },
  [Orientation.CLOCK]: {
    [GridLocation.NORTH]: 0,
    [GridLocation.SOUTH]: 180,
    [GridLocation.WEST]: 270,
    [GridLocation.EAST]: 90,
    [GridLocation.NORTHEAST]: 0,
    [GridLocation.SOUTHEAST]: 0,
    [GridLocation.SOUTHWEST]: 0,
    [GridLocation.NORTHWEST]: 0,
  },
  [Orientation.COUNTER]: {
    [GridLocation.NORTH]: 180,
    [GridLocation.SOUTH]: 0,
    [GridLocation.WEST]: 90,
    [GridLocation.EAST]: 270,
    [GridLocation.NORTHEAST]: 0,
    [GridLocation.SOUTHEAST]: 0,
    [GridLocation.SOUTHWEST]: 0,
    [GridLocation.NORTHWEST]: 0,
  },
  // Interradial orientations (Level 6)
  [Orientation.CLOCK_IN]: {
    [GridLocation.NORTH]: 45,
    [GridLocation.SOUTH]: 225,
    [GridLocation.WEST]: 315,
    [GridLocation.EAST]: 135,
    [GridLocation.NORTHEAST]: 0,
    [GridLocation.SOUTHEAST]: 0,
    [GridLocation.SOUTHWEST]: 0,
    [GridLocation.NORTHWEST]: 0,
  },
  [Orientation.CLOCK_OUT]: {
    [GridLocation.NORTH]: 315,
    [GridLocation.SOUTH]: 135,
    [GridLocation.WEST]: 225,
    [GridLocation.EAST]: 45,
    [GridLocation.NORTHEAST]: 0,
    [GridLocation.SOUTHEAST]: 0,
    [GridLocation.SOUTHWEST]: 0,
    [GridLocation.NORTHWEST]: 0,
  },
  [Orientation.COUNTER_IN]: {
    [GridLocation.NORTH]: 135,
    [GridLocation.SOUTH]: 315,
    [GridLocation.WEST]: 45,
    [GridLocation.EAST]: 225,
    [GridLocation.NORTHEAST]: 0,
    [GridLocation.SOUTHEAST]: 0,
    [GridLocation.SOUTHWEST]: 0,
    [GridLocation.NORTHWEST]: 0,
  },
  [Orientation.COUNTER_OUT]: {
    [GridLocation.NORTH]: 225,
    [GridLocation.SOUTH]: 45,
    [GridLocation.WEST]: 135,
    [GridLocation.EAST]: 315,
    [GridLocation.NORTHEAST]: 0,
    [GridLocation.SOUTHEAST]: 0,
    [GridLocation.SOUTHWEST]: 0,
    [GridLocation.NORTHWEST]: 0,
  },
} as Record<Orientation, Record<GridLocation, number>>;

/**
 * Box grid rotation angles by orientation and location
 */
const BOX_ANGLE_MAP: Record<Orientation, Record<GridLocation, number>> = {
  [Orientation.IN]: {
    [GridLocation.NORTHEAST]: 135,
    [GridLocation.NORTHWEST]: 45,
    [GridLocation.SOUTHWEST]: 315,
    [GridLocation.SOUTHEAST]: 225,
    [GridLocation.NORTH]: 0,
    [GridLocation.SOUTH]: 0,
    [GridLocation.EAST]: 0,
    [GridLocation.WEST]: 0,
  },
  [Orientation.OUT]: {
    [GridLocation.NORTHEAST]: 315,
    [GridLocation.NORTHWEST]: 225,
    [GridLocation.SOUTHWEST]: 135,
    [GridLocation.SOUTHEAST]: 45,
    [GridLocation.NORTH]: 0,
    [GridLocation.SOUTH]: 0,
    [GridLocation.EAST]: 0,
    [GridLocation.WEST]: 0,
  },
  [Orientation.CLOCK]: {
    [GridLocation.NORTHEAST]: 45,
    [GridLocation.NORTHWEST]: 315,
    [GridLocation.SOUTHWEST]: 225,
    [GridLocation.SOUTHEAST]: 135,
    [GridLocation.NORTH]: 0,
    [GridLocation.SOUTH]: 0,
    [GridLocation.EAST]: 0,
    [GridLocation.WEST]: 0,
  },
  [Orientation.COUNTER]: {
    [GridLocation.NORTHEAST]: 225,
    [GridLocation.NORTHWEST]: 135,
    [GridLocation.SOUTHWEST]: 45,
    [GridLocation.SOUTHEAST]: 315,
    [GridLocation.NORTH]: 0,
    [GridLocation.SOUTH]: 0,
    [GridLocation.EAST]: 0,
    [GridLocation.WEST]: 0,
  },
  // Interradial orientations (Level 6)
  [Orientation.CLOCK_IN]: {
    [GridLocation.NORTHEAST]: 90,
    [GridLocation.NORTHWEST]: 0,
    [GridLocation.SOUTHWEST]: 270,
    [GridLocation.SOUTHEAST]: 180,
    [GridLocation.NORTH]: 0,
    [GridLocation.SOUTH]: 0,
    [GridLocation.EAST]: 0,
    [GridLocation.WEST]: 0,
  },
  [Orientation.CLOCK_OUT]: {
    [GridLocation.NORTHEAST]: 0,
    [GridLocation.NORTHWEST]: 270,
    [GridLocation.SOUTHWEST]: 180,
    [GridLocation.SOUTHEAST]: 90,
    [GridLocation.NORTH]: 0,
    [GridLocation.SOUTH]: 0,
    [GridLocation.EAST]: 0,
    [GridLocation.WEST]: 0,
  },
  [Orientation.COUNTER_IN]: {
    [GridLocation.NORTHEAST]: 180,
    [GridLocation.NORTHWEST]: 90,
    [GridLocation.SOUTHWEST]: 0,
    [GridLocation.SOUTHEAST]: 270,
    [GridLocation.NORTH]: 0,
    [GridLocation.SOUTH]: 0,
    [GridLocation.EAST]: 0,
    [GridLocation.WEST]: 0,
  },
  [Orientation.COUNTER_OUT]: {
    [GridLocation.NORTHEAST]: 270,
    [GridLocation.NORTHWEST]: 180,
    [GridLocation.SOUTHWEST]: 90,
    [GridLocation.SOUTHEAST]: 0,
    [GridLocation.NORTH]: 0,
    [GridLocation.SOUTH]: 0,
    [GridLocation.EAST]: 0,
    [GridLocation.WEST]: 0,
  },
} as Record<Orientation, Record<GridLocation, number>>;

// ============================================================================
// PROP PLACEMENT INTERFACE
// ============================================================================

export interface PropPlacement {
  x: number;
  y: number;
  rotation: number;
}

// ============================================================================
// PROP PLACEMENT FUNCTIONS
// ============================================================================

/**
 * Get the appropriate angle map based on grid mode and location
 */
function getAngleMapForLocation(
  location: GridLocation,
  gridMode: GridMode
): Record<Orientation, Record<GridLocation, number>> {
  if (gridMode === GridMode.DIAMOND) {
    return DIAMOND_ANGLE_MAP;
  }
  if (gridMode === GridMode.SKEWED) {
    // In skewed mode, use diamond angles for cardinal, box for intercardinal
    return CARDINAL_LOCATIONS.has(location)
      ? DIAMOND_ANGLE_MAP
      : BOX_ANGLE_MAP;
  }
  // BOX mode or default
  return BOX_ANGLE_MAP;
}

/**
 * Calculate prop rotation angle based on location, orientation, and grid mode
 */
export function calculatePropRotation(
  location: GridLocation | string,
  orientation: Orientation | string,
  gridMode: GridMode
): number {
  const normalizedLocation = (
    typeof location === "string" ? location.toLowerCase() : location
  ) as GridLocation;

  const normalizedOrientation = (
    typeof orientation === "string" ? orientation.toLowerCase() : orientation
  ) as Orientation;

  const angleMap = getAngleMapForLocation(normalizedLocation, gridMode);
  const orientationAngles = angleMap[normalizedOrientation];

  if (!orientationAngles) {
    console.warn(`Unknown orientation: ${normalizedOrientation}`);
    return 0;
  }

  return orientationAngles[normalizedLocation] ?? 0;
}

/**
 * Calculate prop position (x, y coordinates)
 */
export function calculatePropPosition(
  location: GridLocation | string,
  gridMode: GridMode
): Coordinates {
  return getHandPointCoordinates(location, gridMode);
}

/**
 * Calculate complete prop placement (position + rotation)
 */
export function calculatePropPlacement(
  location: GridLocation | string,
  orientation: Orientation | string,
  gridMode: GridMode
): PropPlacement {
  const position = calculatePropPosition(location, gridMode);
  const rotation = calculatePropRotation(location, orientation, gridMode);

  return {
    x: position.x,
    y: position.y,
    rotation,
  };
}
