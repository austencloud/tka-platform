/**
 * Circular Position Maps for LOOP Generation
 *
 * EXACT PORT of client-side circular-position-maps.ts
 * These maps define valid positions and transformations for circular sequences.
 */

// Grid Position enum values (matching client-side GridPosition)
export const GridPosition = {
  ALPHA1: "alpha1",
  ALPHA2: "alpha2",
  ALPHA3: "alpha3",
  ALPHA4: "alpha4",
  ALPHA5: "alpha5",
  ALPHA6: "alpha6",
  ALPHA7: "alpha7",
  ALPHA8: "alpha8",
  BETA1: "beta1",
  BETA2: "beta2",
  BETA3: "beta3",
  BETA4: "beta4",
  BETA5: "beta5",
  BETA6: "beta6",
  BETA7: "beta7",
  BETA8: "beta8",
  GAMMA1: "gamma1",
  GAMMA2: "gamma2",
  GAMMA3: "gamma3",
  GAMMA4: "gamma4",
  GAMMA5: "gamma5",
  GAMMA6: "gamma6",
  GAMMA7: "gamma7",
  GAMMA8: "gamma8",
  GAMMA9: "gamma9",
  GAMMA10: "gamma10",
  GAMMA11: "gamma11",
  GAMMA12: "gamma12",
  GAMMA13: "gamma13",
  GAMMA14: "gamma14",
  GAMMA15: "gamma15",
  GAMMA16: "gamma16",
} as const;

// Grid Location enum values
export const GridLocation = {
  NORTH: "n",
  NORTHEAST: "ne",
  EAST: "e",
  SOUTHEAST: "se",
  SOUTH: "s",
  SOUTHWEST: "sw",
  WEST: "w",
  NORTHWEST: "nw",
} as const;

export type GridLocationValue = (typeof GridLocation)[keyof typeof GridLocation];
export type GridPositionValue = (typeof GridPosition)[keyof typeof GridPosition];

// Rotation direction constants
export const RotationDirection = {
  CLOCKWISE: "cw",
  COUNTER_CLOCKWISE: "ccw",
  NO_ROTATION: "no_rotation",
} as const;

export type RotationDirectionValue =
  | (typeof RotationDirection)[keyof typeof RotationDirection]
  | "dash"
  | "static";

/**
 * Halved LOOP validation set
 * Set of (start_position, end_position) tuples valid for halved LOOPs
 */
export const HALVED_LOOPS = new Set<string>([
  `${GridPosition.ALPHA1},${GridPosition.ALPHA5}`,
  `${GridPosition.ALPHA2},${GridPosition.ALPHA6}`,
  `${GridPosition.ALPHA3},${GridPosition.ALPHA7}`,
  `${GridPosition.ALPHA4},${GridPosition.ALPHA8}`,
  `${GridPosition.ALPHA5},${GridPosition.ALPHA1}`,
  `${GridPosition.ALPHA6},${GridPosition.ALPHA2}`,
  `${GridPosition.ALPHA7},${GridPosition.ALPHA3}`,
  `${GridPosition.ALPHA8},${GridPosition.ALPHA4}`,

  `${GridPosition.BETA1},${GridPosition.BETA5}`,
  `${GridPosition.BETA2},${GridPosition.BETA6}`,
  `${GridPosition.BETA3},${GridPosition.BETA7}`,
  `${GridPosition.BETA4},${GridPosition.BETA8}`,
  `${GridPosition.BETA5},${GridPosition.BETA1}`,
  `${GridPosition.BETA6},${GridPosition.BETA2}`,
  `${GridPosition.BETA7},${GridPosition.BETA3}`,
  `${GridPosition.BETA8},${GridPosition.BETA4}`,

  `${GridPosition.GAMMA1},${GridPosition.GAMMA5}`,
  `${GridPosition.GAMMA2},${GridPosition.GAMMA6}`,
  `${GridPosition.GAMMA3},${GridPosition.GAMMA7}`,
  `${GridPosition.GAMMA4},${GridPosition.GAMMA8}`,
  `${GridPosition.GAMMA5},${GridPosition.GAMMA1}`,
  `${GridPosition.GAMMA6},${GridPosition.GAMMA2}`,
  `${GridPosition.GAMMA7},${GridPosition.GAMMA3}`,
  `${GridPosition.GAMMA8},${GridPosition.GAMMA4}`,

  `${GridPosition.GAMMA9},${GridPosition.GAMMA13}`,
  `${GridPosition.GAMMA10},${GridPosition.GAMMA14}`,
  `${GridPosition.GAMMA11},${GridPosition.GAMMA15}`,
  `${GridPosition.GAMMA12},${GridPosition.GAMMA16}`,
  `${GridPosition.GAMMA13},${GridPosition.GAMMA9}`,
  `${GridPosition.GAMMA14},${GridPosition.GAMMA10}`,
  `${GridPosition.GAMMA15},${GridPosition.GAMMA11}`,
  `${GridPosition.GAMMA16},${GridPosition.GAMMA12}`,
]);

/**
 * Quartered LOOP validation set
 * Set of (start_position, end_position) tuples valid for quartered LOOPs
 */
export const QUARTERED_LOOPS = new Set<string>([
  // Alpha clockwise
  `${GridPosition.ALPHA1},${GridPosition.ALPHA3}`,
  `${GridPosition.ALPHA2},${GridPosition.ALPHA4}`,
  `${GridPosition.ALPHA3},${GridPosition.ALPHA5}`,
  `${GridPosition.ALPHA4},${GridPosition.ALPHA6}`,
  `${GridPosition.ALPHA5},${GridPosition.ALPHA7}`,
  `${GridPosition.ALPHA6},${GridPosition.ALPHA8}`,
  `${GridPosition.ALPHA7},${GridPosition.ALPHA1}`,
  `${GridPosition.ALPHA8},${GridPosition.ALPHA2}`,

  // Alpha counter-clockwise
  `${GridPosition.ALPHA1},${GridPosition.ALPHA7}`,
  `${GridPosition.ALPHA2},${GridPosition.ALPHA8}`,
  `${GridPosition.ALPHA3},${GridPosition.ALPHA1}`,
  `${GridPosition.ALPHA4},${GridPosition.ALPHA2}`,
  `${GridPosition.ALPHA5},${GridPosition.ALPHA3}`,
  `${GridPosition.ALPHA6},${GridPosition.ALPHA4}`,
  `${GridPosition.ALPHA7},${GridPosition.ALPHA5}`,
  `${GridPosition.ALPHA8},${GridPosition.ALPHA6}`,

  // Beta clockwise
  `${GridPosition.BETA1},${GridPosition.BETA3}`,
  `${GridPosition.BETA2},${GridPosition.BETA4}`,
  `${GridPosition.BETA3},${GridPosition.BETA5}`,
  `${GridPosition.BETA4},${GridPosition.BETA6}`,
  `${GridPosition.BETA5},${GridPosition.BETA7}`,
  `${GridPosition.BETA6},${GridPosition.BETA8}`,
  `${GridPosition.BETA7},${GridPosition.BETA1}`,
  `${GridPosition.BETA8},${GridPosition.BETA2}`,

  // Beta counter-clockwise
  `${GridPosition.BETA1},${GridPosition.BETA7}`,
  `${GridPosition.BETA2},${GridPosition.BETA8}`,
  `${GridPosition.BETA3},${GridPosition.BETA1}`,
  `${GridPosition.BETA4},${GridPosition.BETA2}`,
  `${GridPosition.BETA5},${GridPosition.BETA3}`,
  `${GridPosition.BETA6},${GridPosition.BETA4}`,
  `${GridPosition.BETA7},${GridPosition.BETA5}`,
  `${GridPosition.BETA8},${GridPosition.BETA6}`,

  // Gamma 1-8 clockwise
  `${GridPosition.GAMMA1},${GridPosition.GAMMA3}`,
  `${GridPosition.GAMMA2},${GridPosition.GAMMA4}`,
  `${GridPosition.GAMMA3},${GridPosition.GAMMA5}`,
  `${GridPosition.GAMMA4},${GridPosition.GAMMA6}`,
  `${GridPosition.GAMMA5},${GridPosition.GAMMA7}`,
  `${GridPosition.GAMMA6},${GridPosition.GAMMA8}`,
  `${GridPosition.GAMMA7},${GridPosition.GAMMA1}`,
  `${GridPosition.GAMMA8},${GridPosition.GAMMA2}`,

  // Gamma 1-8 counter-clockwise
  `${GridPosition.GAMMA1},${GridPosition.GAMMA7}`,
  `${GridPosition.GAMMA2},${GridPosition.GAMMA8}`,
  `${GridPosition.GAMMA3},${GridPosition.GAMMA1}`,
  `${GridPosition.GAMMA4},${GridPosition.GAMMA2}`,
  `${GridPosition.GAMMA5},${GridPosition.GAMMA3}`,
  `${GridPosition.GAMMA6},${GridPosition.GAMMA4}`,
  `${GridPosition.GAMMA7},${GridPosition.GAMMA5}`,
  `${GridPosition.GAMMA8},${GridPosition.GAMMA6}`,

  // Gamma 9-16 clockwise
  `${GridPosition.GAMMA9},${GridPosition.GAMMA11}`,
  `${GridPosition.GAMMA10},${GridPosition.GAMMA12}`,
  `${GridPosition.GAMMA11},${GridPosition.GAMMA13}`,
  `${GridPosition.GAMMA12},${GridPosition.GAMMA14}`,
  `${GridPosition.GAMMA13},${GridPosition.GAMMA15}`,
  `${GridPosition.GAMMA14},${GridPosition.GAMMA16}`,
  `${GridPosition.GAMMA15},${GridPosition.GAMMA9}`,
  `${GridPosition.GAMMA16},${GridPosition.GAMMA10}`,

  // Gamma 9-16 counter-clockwise
  `${GridPosition.GAMMA9},${GridPosition.GAMMA15}`,
  `${GridPosition.GAMMA10},${GridPosition.GAMMA16}`,
  `${GridPosition.GAMMA11},${GridPosition.GAMMA9}`,
  `${GridPosition.GAMMA12},${GridPosition.GAMMA10}`,
  `${GridPosition.GAMMA13},${GridPosition.GAMMA11}`,
  `${GridPosition.GAMMA14},${GridPosition.GAMMA12}`,
  `${GridPosition.GAMMA15},${GridPosition.GAMMA13}`,
  `${GridPosition.GAMMA16},${GridPosition.GAMMA14}`,
]);

/**
 * Half position map - 180° rotation
 */
export const HALF_POSITION_MAP: Record<string, string> = {
  [GridPosition.ALPHA1]: GridPosition.ALPHA5,
  [GridPosition.ALPHA2]: GridPosition.ALPHA6,
  [GridPosition.ALPHA3]: GridPosition.ALPHA7,
  [GridPosition.ALPHA4]: GridPosition.ALPHA8,
  [GridPosition.ALPHA5]: GridPosition.ALPHA1,
  [GridPosition.ALPHA6]: GridPosition.ALPHA2,
  [GridPosition.ALPHA7]: GridPosition.ALPHA3,
  [GridPosition.ALPHA8]: GridPosition.ALPHA4,

  [GridPosition.BETA1]: GridPosition.BETA5,
  [GridPosition.BETA2]: GridPosition.BETA6,
  [GridPosition.BETA3]: GridPosition.BETA7,
  [GridPosition.BETA4]: GridPosition.BETA8,
  [GridPosition.BETA5]: GridPosition.BETA1,
  [GridPosition.BETA6]: GridPosition.BETA2,
  [GridPosition.BETA7]: GridPosition.BETA3,
  [GridPosition.BETA8]: GridPosition.BETA4,

  [GridPosition.GAMMA1]: GridPosition.GAMMA5,
  [GridPosition.GAMMA2]: GridPosition.GAMMA6,
  [GridPosition.GAMMA3]: GridPosition.GAMMA7,
  [GridPosition.GAMMA4]: GridPosition.GAMMA8,
  [GridPosition.GAMMA5]: GridPosition.GAMMA1,
  [GridPosition.GAMMA6]: GridPosition.GAMMA2,
  [GridPosition.GAMMA7]: GridPosition.GAMMA3,
  [GridPosition.GAMMA8]: GridPosition.GAMMA4,

  [GridPosition.GAMMA9]: GridPosition.GAMMA13,
  [GridPosition.GAMMA10]: GridPosition.GAMMA14,
  [GridPosition.GAMMA11]: GridPosition.GAMMA15,
  [GridPosition.GAMMA12]: GridPosition.GAMMA16,
  [GridPosition.GAMMA13]: GridPosition.GAMMA9,
  [GridPosition.GAMMA14]: GridPosition.GAMMA10,
  [GridPosition.GAMMA15]: GridPosition.GAMMA11,
  [GridPosition.GAMMA16]: GridPosition.GAMMA12,
};

/**
 * Quarter position map - Clockwise 90° rotation
 */
export const QUARTER_POSITION_MAP_CW: Record<string, string> = {
  [GridPosition.ALPHA1]: GridPosition.ALPHA3,
  [GridPosition.ALPHA2]: GridPosition.ALPHA4,
  [GridPosition.ALPHA3]: GridPosition.ALPHA5,
  [GridPosition.ALPHA4]: GridPosition.ALPHA6,
  [GridPosition.ALPHA5]: GridPosition.ALPHA7,
  [GridPosition.ALPHA6]: GridPosition.ALPHA8,
  [GridPosition.ALPHA7]: GridPosition.ALPHA1,
  [GridPosition.ALPHA8]: GridPosition.ALPHA2,

  [GridPosition.BETA1]: GridPosition.BETA3,
  [GridPosition.BETA2]: GridPosition.BETA4,
  [GridPosition.BETA3]: GridPosition.BETA5,
  [GridPosition.BETA4]: GridPosition.BETA6,
  [GridPosition.BETA5]: GridPosition.BETA7,
  [GridPosition.BETA6]: GridPosition.BETA8,
  [GridPosition.BETA7]: GridPosition.BETA1,
  [GridPosition.BETA8]: GridPosition.BETA2,

  [GridPosition.GAMMA1]: GridPosition.GAMMA3,
  [GridPosition.GAMMA2]: GridPosition.GAMMA4,
  [GridPosition.GAMMA3]: GridPosition.GAMMA5,
  [GridPosition.GAMMA4]: GridPosition.GAMMA6,
  [GridPosition.GAMMA5]: GridPosition.GAMMA7,
  [GridPosition.GAMMA6]: GridPosition.GAMMA8,
  [GridPosition.GAMMA7]: GridPosition.GAMMA1,
  [GridPosition.GAMMA8]: GridPosition.GAMMA2,

  [GridPosition.GAMMA9]: GridPosition.GAMMA11,
  [GridPosition.GAMMA10]: GridPosition.GAMMA12,
  [GridPosition.GAMMA11]: GridPosition.GAMMA13,
  [GridPosition.GAMMA12]: GridPosition.GAMMA14,
  [GridPosition.GAMMA13]: GridPosition.GAMMA15,
  [GridPosition.GAMMA14]: GridPosition.GAMMA16,
  [GridPosition.GAMMA15]: GridPosition.GAMMA9,
  [GridPosition.GAMMA16]: GridPosition.GAMMA10,
};

/**
 * Quarter position map - Counter-clockwise 90° rotation
 */
export const QUARTER_POSITION_MAP_CCW: Record<string, string> = {
  [GridPosition.ALPHA1]: GridPosition.ALPHA7,
  [GridPosition.ALPHA2]: GridPosition.ALPHA8,
  [GridPosition.ALPHA3]: GridPosition.ALPHA1,
  [GridPosition.ALPHA4]: GridPosition.ALPHA2,
  [GridPosition.ALPHA5]: GridPosition.ALPHA3,
  [GridPosition.ALPHA6]: GridPosition.ALPHA4,
  [GridPosition.ALPHA7]: GridPosition.ALPHA5,
  [GridPosition.ALPHA8]: GridPosition.ALPHA6,

  [GridPosition.BETA1]: GridPosition.BETA7,
  [GridPosition.BETA2]: GridPosition.BETA8,
  [GridPosition.BETA3]: GridPosition.BETA1,
  [GridPosition.BETA4]: GridPosition.BETA2,
  [GridPosition.BETA5]: GridPosition.BETA3,
  [GridPosition.BETA6]: GridPosition.BETA4,
  [GridPosition.BETA7]: GridPosition.BETA5,
  [GridPosition.BETA8]: GridPosition.BETA6,

  [GridPosition.GAMMA1]: GridPosition.GAMMA7,
  [GridPosition.GAMMA2]: GridPosition.GAMMA8,
  [GridPosition.GAMMA3]: GridPosition.GAMMA1,
  [GridPosition.GAMMA4]: GridPosition.GAMMA2,
  [GridPosition.GAMMA5]: GridPosition.GAMMA3,
  [GridPosition.GAMMA6]: GridPosition.GAMMA4,
  [GridPosition.GAMMA7]: GridPosition.GAMMA5,
  [GridPosition.GAMMA8]: GridPosition.GAMMA6,

  [GridPosition.GAMMA9]: GridPosition.GAMMA15,
  [GridPosition.GAMMA10]: GridPosition.GAMMA16,
  [GridPosition.GAMMA11]: GridPosition.GAMMA9,
  [GridPosition.GAMMA12]: GridPosition.GAMMA10,
  [GridPosition.GAMMA13]: GridPosition.GAMMA11,
  [GridPosition.GAMMA14]: GridPosition.GAMMA12,
  [GridPosition.GAMMA15]: GridPosition.GAMMA13,
  [GridPosition.GAMMA16]: GridPosition.GAMMA14,
};

/**
 * Clockwise location rotation map (90° CW)
 */
export const LOCATION_MAP_CLOCKWISE: Record<string, string> = {
  [GridLocation.SOUTH]: GridLocation.WEST,
  [GridLocation.WEST]: GridLocation.NORTH,
  [GridLocation.NORTH]: GridLocation.EAST,
  [GridLocation.EAST]: GridLocation.SOUTH,
  [GridLocation.NORTHEAST]: GridLocation.SOUTHEAST,
  [GridLocation.SOUTHEAST]: GridLocation.SOUTHWEST,
  [GridLocation.SOUTHWEST]: GridLocation.NORTHWEST,
  [GridLocation.NORTHWEST]: GridLocation.NORTHEAST,
};

/**
 * Counter-clockwise location rotation map (90° CCW)
 */
export const LOCATION_MAP_COUNTER_CLOCKWISE: Record<string, string> = {
  [GridLocation.SOUTH]: GridLocation.EAST,
  [GridLocation.EAST]: GridLocation.NORTH,
  [GridLocation.NORTH]: GridLocation.WEST,
  [GridLocation.WEST]: GridLocation.SOUTH,
  [GridLocation.NORTHEAST]: GridLocation.NORTHWEST,
  [GridLocation.NORTHWEST]: GridLocation.SOUTHWEST,
  [GridLocation.SOUTHWEST]: GridLocation.SOUTHEAST,
  [GridLocation.SOUTHEAST]: GridLocation.NORTHEAST,
};

/**
 * Dash location map (180° flip)
 */
export const LOCATION_MAP_DASH: Record<string, string> = {
  [GridLocation.SOUTH]: GridLocation.NORTH,
  [GridLocation.NORTH]: GridLocation.SOUTH,
  [GridLocation.WEST]: GridLocation.EAST,
  [GridLocation.EAST]: GridLocation.WEST,
  [GridLocation.NORTHEAST]: GridLocation.SOUTHWEST,
  [GridLocation.SOUTHEAST]: GridLocation.NORTHWEST,
  [GridLocation.SOUTHWEST]: GridLocation.NORTHEAST,
  [GridLocation.NORTHWEST]: GridLocation.SOUTHEAST,
};

/**
 * Static location map (no change)
 */
export const LOCATION_MAP_STATIC: Record<string, string> = {
  [GridLocation.SOUTH]: GridLocation.SOUTH,
  [GridLocation.NORTH]: GridLocation.NORTH,
  [GridLocation.WEST]: GridLocation.WEST,
  [GridLocation.EAST]: GridLocation.EAST,
  [GridLocation.NORTHEAST]: GridLocation.NORTHEAST,
  [GridLocation.SOUTHEAST]: GridLocation.SOUTHEAST,
  [GridLocation.SOUTHWEST]: GridLocation.SOUTHWEST,
  [GridLocation.NORTHWEST]: GridLocation.NORTHWEST,
};

/**
 * Mirror location map (horizontal flip: E <-> W)
 */
export const LOCATION_MAP_MIRROR: Record<string, string> = {
  [GridLocation.NORTH]: GridLocation.NORTH,
  [GridLocation.SOUTH]: GridLocation.SOUTH,
  [GridLocation.EAST]: GridLocation.WEST,
  [GridLocation.WEST]: GridLocation.EAST,
  [GridLocation.NORTHEAST]: GridLocation.NORTHWEST,
  [GridLocation.NORTHWEST]: GridLocation.NORTHEAST,
  [GridLocation.SOUTHEAST]: GridLocation.SOUTHWEST,
  [GridLocation.SOUTHWEST]: GridLocation.SOUTHEAST,
};

/**
 * Hand rotation direction map
 * Maps (startLocation, endLocation) to rotation direction
 */
const HAND_ROTATION_DIRECTION_MAP = new Map<string, RotationDirectionValue>([
  // Clockwise cardinal rotations
  [`${GridLocation.SOUTH},${GridLocation.WEST}`, RotationDirection.CLOCKWISE],
  [`${GridLocation.WEST},${GridLocation.NORTH}`, RotationDirection.CLOCKWISE],
  [`${GridLocation.NORTH},${GridLocation.EAST}`, RotationDirection.CLOCKWISE],
  [`${GridLocation.EAST},${GridLocation.SOUTH}`, RotationDirection.CLOCKWISE],

  // Counter-clockwise cardinal rotations
  [`${GridLocation.WEST},${GridLocation.SOUTH}`, RotationDirection.COUNTER_CLOCKWISE],
  [`${GridLocation.NORTH},${GridLocation.WEST}`, RotationDirection.COUNTER_CLOCKWISE],
  [`${GridLocation.EAST},${GridLocation.NORTH}`, RotationDirection.COUNTER_CLOCKWISE],
  [`${GridLocation.SOUTH},${GridLocation.EAST}`, RotationDirection.COUNTER_CLOCKWISE],

  // Dash movements
  [`${GridLocation.SOUTH},${GridLocation.NORTH}`, "dash"],
  [`${GridLocation.WEST},${GridLocation.EAST}`, "dash"],
  [`${GridLocation.NORTH},${GridLocation.SOUTH}`, "dash"],
  [`${GridLocation.EAST},${GridLocation.WEST}`, "dash"],

  // Static (no movement)
  [`${GridLocation.NORTH},${GridLocation.NORTH}`, "static"],
  [`${GridLocation.EAST},${GridLocation.EAST}`, "static"],
  [`${GridLocation.SOUTH},${GridLocation.SOUTH}`, "static"],
  [`${GridLocation.WEST},${GridLocation.WEST}`, "static"],

  // Clockwise diagonal rotations
  [`${GridLocation.NORTHEAST},${GridLocation.SOUTHEAST}`, RotationDirection.CLOCKWISE],
  [`${GridLocation.SOUTHEAST},${GridLocation.SOUTHWEST}`, RotationDirection.CLOCKWISE],
  [`${GridLocation.SOUTHWEST},${GridLocation.NORTHWEST}`, RotationDirection.CLOCKWISE],
  [`${GridLocation.NORTHWEST},${GridLocation.NORTHEAST}`, RotationDirection.CLOCKWISE],

  // Counter-clockwise diagonal rotations
  [`${GridLocation.NORTHEAST},${GridLocation.NORTHWEST}`, RotationDirection.COUNTER_CLOCKWISE],
  [`${GridLocation.NORTHWEST},${GridLocation.SOUTHWEST}`, RotationDirection.COUNTER_CLOCKWISE],
  [`${GridLocation.SOUTHWEST},${GridLocation.SOUTHEAST}`, RotationDirection.COUNTER_CLOCKWISE],
  [`${GridLocation.SOUTHEAST},${GridLocation.NORTHEAST}`, RotationDirection.COUNTER_CLOCKWISE],

  // Dash diagonal movements
  [`${GridLocation.NORTHEAST},${GridLocation.SOUTHWEST}`, "dash"],
  [`${GridLocation.SOUTHEAST},${GridLocation.NORTHWEST}`, "dash"],
  [`${GridLocation.SOUTHWEST},${GridLocation.NORTHEAST}`, "dash"],
  [`${GridLocation.NORTHWEST},${GridLocation.SOUTHEAST}`, "dash"],

  // Static diagonal
  [`${GridLocation.NORTHEAST},${GridLocation.NORTHEAST}`, "static"],
  [`${GridLocation.SOUTHEAST},${GridLocation.SOUTHEAST}`, "static"],
  [`${GridLocation.SOUTHWEST},${GridLocation.SOUTHWEST}`, "static"],
  [`${GridLocation.NORTHWEST},${GridLocation.NORTHWEST}`, "static"],
]);

/**
 * Determine hand rotation direction based on start and end locations
 */
export function getHandRotationDirection(
  startLocation: string,
  endLocation: string
): RotationDirectionValue {
  const key = `${startLocation},${endLocation}`;
  const direction = HAND_ROTATION_DIRECTION_MAP.get(key);

  if (!direction) {
    // Default to static if not found (edge case)
    console.warn(`No hand rotation direction found for ${startLocation} → ${endLocation}, defaulting to static`);
    return "static";
  }

  return direction;
}

/**
 * Get location map for hand rotation
 */
export function getLocationMapForHandRotation(
  handRotationDir: RotationDirectionValue
): Record<string, string> {
  switch (handRotationDir) {
    case RotationDirection.CLOCKWISE:
      return LOCATION_MAP_CLOCKWISE;
    case RotationDirection.COUNTER_CLOCKWISE:
      return LOCATION_MAP_COUNTER_CLOCKWISE;
    case "dash":
      return LOCATION_MAP_DASH;
    case "static":
      return LOCATION_MAP_STATIC;
    default:
      return LOCATION_MAP_STATIC;
  }
}

/**
 * Grid position to locations map (for diamond grid mode)
 * Maps each grid position to [blueLocation, redLocation]
 */
export const POSITION_TO_LOCATIONS: Record<string, [string, string]> = {
  // Alpha positions (blue and red at opposite locations)
  [GridPosition.ALPHA1]: [GridLocation.NORTH, GridLocation.SOUTH],
  [GridPosition.ALPHA2]: [GridLocation.NORTHEAST, GridLocation.SOUTHWEST],
  [GridPosition.ALPHA3]: [GridLocation.EAST, GridLocation.WEST],
  [GridPosition.ALPHA4]: [GridLocation.SOUTHEAST, GridLocation.NORTHWEST],
  [GridPosition.ALPHA5]: [GridLocation.SOUTH, GridLocation.NORTH],
  [GridPosition.ALPHA6]: [GridLocation.SOUTHWEST, GridLocation.NORTHEAST],
  [GridPosition.ALPHA7]: [GridLocation.WEST, GridLocation.EAST],
  [GridPosition.ALPHA8]: [GridLocation.NORTHWEST, GridLocation.SOUTHEAST],

  // Beta positions (blue and red at same location)
  [GridPosition.BETA1]: [GridLocation.NORTH, GridLocation.NORTH],
  [GridPosition.BETA2]: [GridLocation.NORTHEAST, GridLocation.NORTHEAST],
  [GridPosition.BETA3]: [GridLocation.EAST, GridLocation.EAST],
  [GridPosition.BETA4]: [GridLocation.SOUTHEAST, GridLocation.SOUTHEAST],
  [GridPosition.BETA5]: [GridLocation.SOUTH, GridLocation.SOUTH],
  [GridPosition.BETA6]: [GridLocation.SOUTHWEST, GridLocation.SOUTHWEST],
  [GridPosition.BETA7]: [GridLocation.WEST, GridLocation.WEST],
  [GridPosition.BETA8]: [GridLocation.NORTHWEST, GridLocation.NORTHWEST],

  // Gamma positions (blue and red at adjacent cardinal locations)
  [GridPosition.GAMMA1]: [GridLocation.NORTH, GridLocation.EAST],
  [GridPosition.GAMMA2]: [GridLocation.NORTH, GridLocation.WEST],
  [GridPosition.GAMMA3]: [GridLocation.EAST, GridLocation.SOUTH],
  [GridPosition.GAMMA4]: [GridLocation.EAST, GridLocation.NORTH],
  [GridPosition.GAMMA5]: [GridLocation.SOUTH, GridLocation.WEST],
  [GridPosition.GAMMA6]: [GridLocation.SOUTH, GridLocation.EAST],
  [GridPosition.GAMMA7]: [GridLocation.WEST, GridLocation.NORTH],
  [GridPosition.GAMMA8]: [GridLocation.WEST, GridLocation.SOUTH],
  [GridPosition.GAMMA9]: [GridLocation.NORTHEAST, GridLocation.SOUTHEAST],
  [GridPosition.GAMMA10]: [GridLocation.NORTHEAST, GridLocation.NORTHWEST],
  [GridPosition.GAMMA11]: [GridLocation.SOUTHEAST, GridLocation.SOUTHWEST],
  [GridPosition.GAMMA12]: [GridLocation.SOUTHEAST, GridLocation.NORTHEAST],
  [GridPosition.GAMMA13]: [GridLocation.SOUTHWEST, GridLocation.NORTHWEST],
  [GridPosition.GAMMA14]: [GridLocation.SOUTHWEST, GridLocation.SOUTHEAST],
  [GridPosition.GAMMA15]: [GridLocation.NORTHWEST, GridLocation.NORTHEAST],
  [GridPosition.GAMMA16]: [GridLocation.NORTHWEST, GridLocation.SOUTHWEST],
};

/**
 * Reverse lookup: locations to position
 */
const LOCATIONS_TO_POSITION = new Map<string, string>();
for (const [position, [blue, red]] of Object.entries(POSITION_TO_LOCATIONS)) {
  LOCATIONS_TO_POSITION.set(`${blue},${red}`, position);
}

/**
 * Get grid position from blue and red locations
 */
export function getGridPositionFromLocations(
  blueLocation: string,
  redLocation: string
): string | null {
  const key = `${blueLocation},${redLocation}`;
  return LOCATIONS_TO_POSITION.get(key) ?? null;
}

/**
 * Get locations from grid position
 */
export function getLocationsFromPosition(position: string): [string, string] | null {
  return POSITION_TO_LOCATIONS[position] ?? null;
}
