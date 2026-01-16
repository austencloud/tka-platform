"use strict";
/**
 * Circular Position Maps for LOOP Generation
 *
 * EXACT PORT of client-side circular-position-maps.ts
 * These maps define valid positions and transformations for circular sequences.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.POSITION_TO_LOCATIONS = exports.LOCATION_MAP_MIRROR = exports.LOCATION_MAP_STATIC = exports.LOCATION_MAP_DASH = exports.LOCATION_MAP_COUNTER_CLOCKWISE = exports.LOCATION_MAP_CLOCKWISE = exports.QUARTER_POSITION_MAP_CCW = exports.QUARTER_POSITION_MAP_CW = exports.HALF_POSITION_MAP = exports.QUARTERED_LOOPS = exports.HALVED_LOOPS = exports.RotationDirection = exports.GridLocation = exports.GridPosition = void 0;
exports.getHandRotationDirection = getHandRotationDirection;
exports.getLocationMapForHandRotation = getLocationMapForHandRotation;
exports.getGridPositionFromLocations = getGridPositionFromLocations;
exports.getLocationsFromPosition = getLocationsFromPosition;
// Grid Position enum values (matching client-side GridPosition)
exports.GridPosition = {
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
};
// Grid Location enum values
exports.GridLocation = {
    NORTH: "n",
    NORTHEAST: "ne",
    EAST: "e",
    SOUTHEAST: "se",
    SOUTH: "s",
    SOUTHWEST: "sw",
    WEST: "w",
    NORTHWEST: "nw",
};
// Rotation direction constants
exports.RotationDirection = {
    CLOCKWISE: "cw",
    COUNTER_CLOCKWISE: "ccw",
    NO_ROTATION: "no_rotation",
};
/**
 * Halved LOOP validation set
 * Set of (start_position, end_position) tuples valid for halved LOOPs
 */
exports.HALVED_LOOPS = new Set([
    `${exports.GridPosition.ALPHA1},${exports.GridPosition.ALPHA5}`,
    `${exports.GridPosition.ALPHA2},${exports.GridPosition.ALPHA6}`,
    `${exports.GridPosition.ALPHA3},${exports.GridPosition.ALPHA7}`,
    `${exports.GridPosition.ALPHA4},${exports.GridPosition.ALPHA8}`,
    `${exports.GridPosition.ALPHA5},${exports.GridPosition.ALPHA1}`,
    `${exports.GridPosition.ALPHA6},${exports.GridPosition.ALPHA2}`,
    `${exports.GridPosition.ALPHA7},${exports.GridPosition.ALPHA3}`,
    `${exports.GridPosition.ALPHA8},${exports.GridPosition.ALPHA4}`,
    `${exports.GridPosition.BETA1},${exports.GridPosition.BETA5}`,
    `${exports.GridPosition.BETA2},${exports.GridPosition.BETA6}`,
    `${exports.GridPosition.BETA3},${exports.GridPosition.BETA7}`,
    `${exports.GridPosition.BETA4},${exports.GridPosition.BETA8}`,
    `${exports.GridPosition.BETA5},${exports.GridPosition.BETA1}`,
    `${exports.GridPosition.BETA6},${exports.GridPosition.BETA2}`,
    `${exports.GridPosition.BETA7},${exports.GridPosition.BETA3}`,
    `${exports.GridPosition.BETA8},${exports.GridPosition.BETA4}`,
    `${exports.GridPosition.GAMMA1},${exports.GridPosition.GAMMA5}`,
    `${exports.GridPosition.GAMMA2},${exports.GridPosition.GAMMA6}`,
    `${exports.GridPosition.GAMMA3},${exports.GridPosition.GAMMA7}`,
    `${exports.GridPosition.GAMMA4},${exports.GridPosition.GAMMA8}`,
    `${exports.GridPosition.GAMMA5},${exports.GridPosition.GAMMA1}`,
    `${exports.GridPosition.GAMMA6},${exports.GridPosition.GAMMA2}`,
    `${exports.GridPosition.GAMMA7},${exports.GridPosition.GAMMA3}`,
    `${exports.GridPosition.GAMMA8},${exports.GridPosition.GAMMA4}`,
    `${exports.GridPosition.GAMMA9},${exports.GridPosition.GAMMA13}`,
    `${exports.GridPosition.GAMMA10},${exports.GridPosition.GAMMA14}`,
    `${exports.GridPosition.GAMMA11},${exports.GridPosition.GAMMA15}`,
    `${exports.GridPosition.GAMMA12},${exports.GridPosition.GAMMA16}`,
    `${exports.GridPosition.GAMMA13},${exports.GridPosition.GAMMA9}`,
    `${exports.GridPosition.GAMMA14},${exports.GridPosition.GAMMA10}`,
    `${exports.GridPosition.GAMMA15},${exports.GridPosition.GAMMA11}`,
    `${exports.GridPosition.GAMMA16},${exports.GridPosition.GAMMA12}`,
]);
/**
 * Quartered LOOP validation set
 * Set of (start_position, end_position) tuples valid for quartered LOOPs
 */
exports.QUARTERED_LOOPS = new Set([
    // Alpha clockwise
    `${exports.GridPosition.ALPHA1},${exports.GridPosition.ALPHA3}`,
    `${exports.GridPosition.ALPHA2},${exports.GridPosition.ALPHA4}`,
    `${exports.GridPosition.ALPHA3},${exports.GridPosition.ALPHA5}`,
    `${exports.GridPosition.ALPHA4},${exports.GridPosition.ALPHA6}`,
    `${exports.GridPosition.ALPHA5},${exports.GridPosition.ALPHA7}`,
    `${exports.GridPosition.ALPHA6},${exports.GridPosition.ALPHA8}`,
    `${exports.GridPosition.ALPHA7},${exports.GridPosition.ALPHA1}`,
    `${exports.GridPosition.ALPHA8},${exports.GridPosition.ALPHA2}`,
    // Alpha counter-clockwise
    `${exports.GridPosition.ALPHA1},${exports.GridPosition.ALPHA7}`,
    `${exports.GridPosition.ALPHA2},${exports.GridPosition.ALPHA8}`,
    `${exports.GridPosition.ALPHA3},${exports.GridPosition.ALPHA1}`,
    `${exports.GridPosition.ALPHA4},${exports.GridPosition.ALPHA2}`,
    `${exports.GridPosition.ALPHA5},${exports.GridPosition.ALPHA3}`,
    `${exports.GridPosition.ALPHA6},${exports.GridPosition.ALPHA4}`,
    `${exports.GridPosition.ALPHA7},${exports.GridPosition.ALPHA5}`,
    `${exports.GridPosition.ALPHA8},${exports.GridPosition.ALPHA6}`,
    // Beta clockwise
    `${exports.GridPosition.BETA1},${exports.GridPosition.BETA3}`,
    `${exports.GridPosition.BETA2},${exports.GridPosition.BETA4}`,
    `${exports.GridPosition.BETA3},${exports.GridPosition.BETA5}`,
    `${exports.GridPosition.BETA4},${exports.GridPosition.BETA6}`,
    `${exports.GridPosition.BETA5},${exports.GridPosition.BETA7}`,
    `${exports.GridPosition.BETA6},${exports.GridPosition.BETA8}`,
    `${exports.GridPosition.BETA7},${exports.GridPosition.BETA1}`,
    `${exports.GridPosition.BETA8},${exports.GridPosition.BETA2}`,
    // Beta counter-clockwise
    `${exports.GridPosition.BETA1},${exports.GridPosition.BETA7}`,
    `${exports.GridPosition.BETA2},${exports.GridPosition.BETA8}`,
    `${exports.GridPosition.BETA3},${exports.GridPosition.BETA1}`,
    `${exports.GridPosition.BETA4},${exports.GridPosition.BETA2}`,
    `${exports.GridPosition.BETA5},${exports.GridPosition.BETA3}`,
    `${exports.GridPosition.BETA6},${exports.GridPosition.BETA4}`,
    `${exports.GridPosition.BETA7},${exports.GridPosition.BETA5}`,
    `${exports.GridPosition.BETA8},${exports.GridPosition.BETA6}`,
    // Gamma 1-8 clockwise
    `${exports.GridPosition.GAMMA1},${exports.GridPosition.GAMMA3}`,
    `${exports.GridPosition.GAMMA2},${exports.GridPosition.GAMMA4}`,
    `${exports.GridPosition.GAMMA3},${exports.GridPosition.GAMMA5}`,
    `${exports.GridPosition.GAMMA4},${exports.GridPosition.GAMMA6}`,
    `${exports.GridPosition.GAMMA5},${exports.GridPosition.GAMMA7}`,
    `${exports.GridPosition.GAMMA6},${exports.GridPosition.GAMMA8}`,
    `${exports.GridPosition.GAMMA7},${exports.GridPosition.GAMMA1}`,
    `${exports.GridPosition.GAMMA8},${exports.GridPosition.GAMMA2}`,
    // Gamma 1-8 counter-clockwise
    `${exports.GridPosition.GAMMA1},${exports.GridPosition.GAMMA7}`,
    `${exports.GridPosition.GAMMA2},${exports.GridPosition.GAMMA8}`,
    `${exports.GridPosition.GAMMA3},${exports.GridPosition.GAMMA1}`,
    `${exports.GridPosition.GAMMA4},${exports.GridPosition.GAMMA2}`,
    `${exports.GridPosition.GAMMA5},${exports.GridPosition.GAMMA3}`,
    `${exports.GridPosition.GAMMA6},${exports.GridPosition.GAMMA4}`,
    `${exports.GridPosition.GAMMA7},${exports.GridPosition.GAMMA5}`,
    `${exports.GridPosition.GAMMA8},${exports.GridPosition.GAMMA6}`,
    // Gamma 9-16 clockwise
    `${exports.GridPosition.GAMMA9},${exports.GridPosition.GAMMA11}`,
    `${exports.GridPosition.GAMMA10},${exports.GridPosition.GAMMA12}`,
    `${exports.GridPosition.GAMMA11},${exports.GridPosition.GAMMA13}`,
    `${exports.GridPosition.GAMMA12},${exports.GridPosition.GAMMA14}`,
    `${exports.GridPosition.GAMMA13},${exports.GridPosition.GAMMA15}`,
    `${exports.GridPosition.GAMMA14},${exports.GridPosition.GAMMA16}`,
    `${exports.GridPosition.GAMMA15},${exports.GridPosition.GAMMA9}`,
    `${exports.GridPosition.GAMMA16},${exports.GridPosition.GAMMA10}`,
    // Gamma 9-16 counter-clockwise
    `${exports.GridPosition.GAMMA9},${exports.GridPosition.GAMMA15}`,
    `${exports.GridPosition.GAMMA10},${exports.GridPosition.GAMMA16}`,
    `${exports.GridPosition.GAMMA11},${exports.GridPosition.GAMMA9}`,
    `${exports.GridPosition.GAMMA12},${exports.GridPosition.GAMMA10}`,
    `${exports.GridPosition.GAMMA13},${exports.GridPosition.GAMMA11}`,
    `${exports.GridPosition.GAMMA14},${exports.GridPosition.GAMMA12}`,
    `${exports.GridPosition.GAMMA15},${exports.GridPosition.GAMMA13}`,
    `${exports.GridPosition.GAMMA16},${exports.GridPosition.GAMMA14}`,
]);
/**
 * Half position map - 180° rotation
 */
exports.HALF_POSITION_MAP = {
    [exports.GridPosition.ALPHA1]: exports.GridPosition.ALPHA5,
    [exports.GridPosition.ALPHA2]: exports.GridPosition.ALPHA6,
    [exports.GridPosition.ALPHA3]: exports.GridPosition.ALPHA7,
    [exports.GridPosition.ALPHA4]: exports.GridPosition.ALPHA8,
    [exports.GridPosition.ALPHA5]: exports.GridPosition.ALPHA1,
    [exports.GridPosition.ALPHA6]: exports.GridPosition.ALPHA2,
    [exports.GridPosition.ALPHA7]: exports.GridPosition.ALPHA3,
    [exports.GridPosition.ALPHA8]: exports.GridPosition.ALPHA4,
    [exports.GridPosition.BETA1]: exports.GridPosition.BETA5,
    [exports.GridPosition.BETA2]: exports.GridPosition.BETA6,
    [exports.GridPosition.BETA3]: exports.GridPosition.BETA7,
    [exports.GridPosition.BETA4]: exports.GridPosition.BETA8,
    [exports.GridPosition.BETA5]: exports.GridPosition.BETA1,
    [exports.GridPosition.BETA6]: exports.GridPosition.BETA2,
    [exports.GridPosition.BETA7]: exports.GridPosition.BETA3,
    [exports.GridPosition.BETA8]: exports.GridPosition.BETA4,
    [exports.GridPosition.GAMMA1]: exports.GridPosition.GAMMA5,
    [exports.GridPosition.GAMMA2]: exports.GridPosition.GAMMA6,
    [exports.GridPosition.GAMMA3]: exports.GridPosition.GAMMA7,
    [exports.GridPosition.GAMMA4]: exports.GridPosition.GAMMA8,
    [exports.GridPosition.GAMMA5]: exports.GridPosition.GAMMA1,
    [exports.GridPosition.GAMMA6]: exports.GridPosition.GAMMA2,
    [exports.GridPosition.GAMMA7]: exports.GridPosition.GAMMA3,
    [exports.GridPosition.GAMMA8]: exports.GridPosition.GAMMA4,
    [exports.GridPosition.GAMMA9]: exports.GridPosition.GAMMA13,
    [exports.GridPosition.GAMMA10]: exports.GridPosition.GAMMA14,
    [exports.GridPosition.GAMMA11]: exports.GridPosition.GAMMA15,
    [exports.GridPosition.GAMMA12]: exports.GridPosition.GAMMA16,
    [exports.GridPosition.GAMMA13]: exports.GridPosition.GAMMA9,
    [exports.GridPosition.GAMMA14]: exports.GridPosition.GAMMA10,
    [exports.GridPosition.GAMMA15]: exports.GridPosition.GAMMA11,
    [exports.GridPosition.GAMMA16]: exports.GridPosition.GAMMA12,
};
/**
 * Quarter position map - Clockwise 90° rotation
 */
exports.QUARTER_POSITION_MAP_CW = {
    [exports.GridPosition.ALPHA1]: exports.GridPosition.ALPHA3,
    [exports.GridPosition.ALPHA2]: exports.GridPosition.ALPHA4,
    [exports.GridPosition.ALPHA3]: exports.GridPosition.ALPHA5,
    [exports.GridPosition.ALPHA4]: exports.GridPosition.ALPHA6,
    [exports.GridPosition.ALPHA5]: exports.GridPosition.ALPHA7,
    [exports.GridPosition.ALPHA6]: exports.GridPosition.ALPHA8,
    [exports.GridPosition.ALPHA7]: exports.GridPosition.ALPHA1,
    [exports.GridPosition.ALPHA8]: exports.GridPosition.ALPHA2,
    [exports.GridPosition.BETA1]: exports.GridPosition.BETA3,
    [exports.GridPosition.BETA2]: exports.GridPosition.BETA4,
    [exports.GridPosition.BETA3]: exports.GridPosition.BETA5,
    [exports.GridPosition.BETA4]: exports.GridPosition.BETA6,
    [exports.GridPosition.BETA5]: exports.GridPosition.BETA7,
    [exports.GridPosition.BETA6]: exports.GridPosition.BETA8,
    [exports.GridPosition.BETA7]: exports.GridPosition.BETA1,
    [exports.GridPosition.BETA8]: exports.GridPosition.BETA2,
    [exports.GridPosition.GAMMA1]: exports.GridPosition.GAMMA3,
    [exports.GridPosition.GAMMA2]: exports.GridPosition.GAMMA4,
    [exports.GridPosition.GAMMA3]: exports.GridPosition.GAMMA5,
    [exports.GridPosition.GAMMA4]: exports.GridPosition.GAMMA6,
    [exports.GridPosition.GAMMA5]: exports.GridPosition.GAMMA7,
    [exports.GridPosition.GAMMA6]: exports.GridPosition.GAMMA8,
    [exports.GridPosition.GAMMA7]: exports.GridPosition.GAMMA1,
    [exports.GridPosition.GAMMA8]: exports.GridPosition.GAMMA2,
    [exports.GridPosition.GAMMA9]: exports.GridPosition.GAMMA11,
    [exports.GridPosition.GAMMA10]: exports.GridPosition.GAMMA12,
    [exports.GridPosition.GAMMA11]: exports.GridPosition.GAMMA13,
    [exports.GridPosition.GAMMA12]: exports.GridPosition.GAMMA14,
    [exports.GridPosition.GAMMA13]: exports.GridPosition.GAMMA15,
    [exports.GridPosition.GAMMA14]: exports.GridPosition.GAMMA16,
    [exports.GridPosition.GAMMA15]: exports.GridPosition.GAMMA9,
    [exports.GridPosition.GAMMA16]: exports.GridPosition.GAMMA10,
};
/**
 * Quarter position map - Counter-clockwise 90° rotation
 */
exports.QUARTER_POSITION_MAP_CCW = {
    [exports.GridPosition.ALPHA1]: exports.GridPosition.ALPHA7,
    [exports.GridPosition.ALPHA2]: exports.GridPosition.ALPHA8,
    [exports.GridPosition.ALPHA3]: exports.GridPosition.ALPHA1,
    [exports.GridPosition.ALPHA4]: exports.GridPosition.ALPHA2,
    [exports.GridPosition.ALPHA5]: exports.GridPosition.ALPHA3,
    [exports.GridPosition.ALPHA6]: exports.GridPosition.ALPHA4,
    [exports.GridPosition.ALPHA7]: exports.GridPosition.ALPHA5,
    [exports.GridPosition.ALPHA8]: exports.GridPosition.ALPHA6,
    [exports.GridPosition.BETA1]: exports.GridPosition.BETA7,
    [exports.GridPosition.BETA2]: exports.GridPosition.BETA8,
    [exports.GridPosition.BETA3]: exports.GridPosition.BETA1,
    [exports.GridPosition.BETA4]: exports.GridPosition.BETA2,
    [exports.GridPosition.BETA5]: exports.GridPosition.BETA3,
    [exports.GridPosition.BETA6]: exports.GridPosition.BETA4,
    [exports.GridPosition.BETA7]: exports.GridPosition.BETA5,
    [exports.GridPosition.BETA8]: exports.GridPosition.BETA6,
    [exports.GridPosition.GAMMA1]: exports.GridPosition.GAMMA7,
    [exports.GridPosition.GAMMA2]: exports.GridPosition.GAMMA8,
    [exports.GridPosition.GAMMA3]: exports.GridPosition.GAMMA1,
    [exports.GridPosition.GAMMA4]: exports.GridPosition.GAMMA2,
    [exports.GridPosition.GAMMA5]: exports.GridPosition.GAMMA3,
    [exports.GridPosition.GAMMA6]: exports.GridPosition.GAMMA4,
    [exports.GridPosition.GAMMA7]: exports.GridPosition.GAMMA5,
    [exports.GridPosition.GAMMA8]: exports.GridPosition.GAMMA6,
    [exports.GridPosition.GAMMA9]: exports.GridPosition.GAMMA15,
    [exports.GridPosition.GAMMA10]: exports.GridPosition.GAMMA16,
    [exports.GridPosition.GAMMA11]: exports.GridPosition.GAMMA9,
    [exports.GridPosition.GAMMA12]: exports.GridPosition.GAMMA10,
    [exports.GridPosition.GAMMA13]: exports.GridPosition.GAMMA11,
    [exports.GridPosition.GAMMA14]: exports.GridPosition.GAMMA12,
    [exports.GridPosition.GAMMA15]: exports.GridPosition.GAMMA13,
    [exports.GridPosition.GAMMA16]: exports.GridPosition.GAMMA14,
};
/**
 * Clockwise location rotation map (90° CW)
 */
exports.LOCATION_MAP_CLOCKWISE = {
    [exports.GridLocation.SOUTH]: exports.GridLocation.WEST,
    [exports.GridLocation.WEST]: exports.GridLocation.NORTH,
    [exports.GridLocation.NORTH]: exports.GridLocation.EAST,
    [exports.GridLocation.EAST]: exports.GridLocation.SOUTH,
    [exports.GridLocation.NORTHEAST]: exports.GridLocation.SOUTHEAST,
    [exports.GridLocation.SOUTHEAST]: exports.GridLocation.SOUTHWEST,
    [exports.GridLocation.SOUTHWEST]: exports.GridLocation.NORTHWEST,
    [exports.GridLocation.NORTHWEST]: exports.GridLocation.NORTHEAST,
};
/**
 * Counter-clockwise location rotation map (90° CCW)
 */
exports.LOCATION_MAP_COUNTER_CLOCKWISE = {
    [exports.GridLocation.SOUTH]: exports.GridLocation.EAST,
    [exports.GridLocation.EAST]: exports.GridLocation.NORTH,
    [exports.GridLocation.NORTH]: exports.GridLocation.WEST,
    [exports.GridLocation.WEST]: exports.GridLocation.SOUTH,
    [exports.GridLocation.NORTHEAST]: exports.GridLocation.NORTHWEST,
    [exports.GridLocation.NORTHWEST]: exports.GridLocation.SOUTHWEST,
    [exports.GridLocation.SOUTHWEST]: exports.GridLocation.SOUTHEAST,
    [exports.GridLocation.SOUTHEAST]: exports.GridLocation.NORTHEAST,
};
/**
 * Dash location map (180° flip)
 */
exports.LOCATION_MAP_DASH = {
    [exports.GridLocation.SOUTH]: exports.GridLocation.NORTH,
    [exports.GridLocation.NORTH]: exports.GridLocation.SOUTH,
    [exports.GridLocation.WEST]: exports.GridLocation.EAST,
    [exports.GridLocation.EAST]: exports.GridLocation.WEST,
    [exports.GridLocation.NORTHEAST]: exports.GridLocation.SOUTHWEST,
    [exports.GridLocation.SOUTHEAST]: exports.GridLocation.NORTHWEST,
    [exports.GridLocation.SOUTHWEST]: exports.GridLocation.NORTHEAST,
    [exports.GridLocation.NORTHWEST]: exports.GridLocation.SOUTHEAST,
};
/**
 * Static location map (no change)
 */
exports.LOCATION_MAP_STATIC = {
    [exports.GridLocation.SOUTH]: exports.GridLocation.SOUTH,
    [exports.GridLocation.NORTH]: exports.GridLocation.NORTH,
    [exports.GridLocation.WEST]: exports.GridLocation.WEST,
    [exports.GridLocation.EAST]: exports.GridLocation.EAST,
    [exports.GridLocation.NORTHEAST]: exports.GridLocation.NORTHEAST,
    [exports.GridLocation.SOUTHEAST]: exports.GridLocation.SOUTHEAST,
    [exports.GridLocation.SOUTHWEST]: exports.GridLocation.SOUTHWEST,
    [exports.GridLocation.NORTHWEST]: exports.GridLocation.NORTHWEST,
};
/**
 * Mirror location map (horizontal flip: E <-> W)
 */
exports.LOCATION_MAP_MIRROR = {
    [exports.GridLocation.NORTH]: exports.GridLocation.NORTH,
    [exports.GridLocation.SOUTH]: exports.GridLocation.SOUTH,
    [exports.GridLocation.EAST]: exports.GridLocation.WEST,
    [exports.GridLocation.WEST]: exports.GridLocation.EAST,
    [exports.GridLocation.NORTHEAST]: exports.GridLocation.NORTHWEST,
    [exports.GridLocation.NORTHWEST]: exports.GridLocation.NORTHEAST,
    [exports.GridLocation.SOUTHEAST]: exports.GridLocation.SOUTHWEST,
    [exports.GridLocation.SOUTHWEST]: exports.GridLocation.SOUTHEAST,
};
/**
 * Hand rotation direction map
 * Maps (startLocation, endLocation) to rotation direction
 */
const HAND_ROTATION_DIRECTION_MAP = new Map([
    // Clockwise cardinal rotations
    [`${exports.GridLocation.SOUTH},${exports.GridLocation.WEST}`, exports.RotationDirection.CLOCKWISE],
    [`${exports.GridLocation.WEST},${exports.GridLocation.NORTH}`, exports.RotationDirection.CLOCKWISE],
    [`${exports.GridLocation.NORTH},${exports.GridLocation.EAST}`, exports.RotationDirection.CLOCKWISE],
    [`${exports.GridLocation.EAST},${exports.GridLocation.SOUTH}`, exports.RotationDirection.CLOCKWISE],
    // Counter-clockwise cardinal rotations
    [`${exports.GridLocation.WEST},${exports.GridLocation.SOUTH}`, exports.RotationDirection.COUNTER_CLOCKWISE],
    [`${exports.GridLocation.NORTH},${exports.GridLocation.WEST}`, exports.RotationDirection.COUNTER_CLOCKWISE],
    [`${exports.GridLocation.EAST},${exports.GridLocation.NORTH}`, exports.RotationDirection.COUNTER_CLOCKWISE],
    [`${exports.GridLocation.SOUTH},${exports.GridLocation.EAST}`, exports.RotationDirection.COUNTER_CLOCKWISE],
    // Dash movements
    [`${exports.GridLocation.SOUTH},${exports.GridLocation.NORTH}`, "dash"],
    [`${exports.GridLocation.WEST},${exports.GridLocation.EAST}`, "dash"],
    [`${exports.GridLocation.NORTH},${exports.GridLocation.SOUTH}`, "dash"],
    [`${exports.GridLocation.EAST},${exports.GridLocation.WEST}`, "dash"],
    // Static (no movement)
    [`${exports.GridLocation.NORTH},${exports.GridLocation.NORTH}`, "static"],
    [`${exports.GridLocation.EAST},${exports.GridLocation.EAST}`, "static"],
    [`${exports.GridLocation.SOUTH},${exports.GridLocation.SOUTH}`, "static"],
    [`${exports.GridLocation.WEST},${exports.GridLocation.WEST}`, "static"],
    // Clockwise diagonal rotations
    [`${exports.GridLocation.NORTHEAST},${exports.GridLocation.SOUTHEAST}`, exports.RotationDirection.CLOCKWISE],
    [`${exports.GridLocation.SOUTHEAST},${exports.GridLocation.SOUTHWEST}`, exports.RotationDirection.CLOCKWISE],
    [`${exports.GridLocation.SOUTHWEST},${exports.GridLocation.NORTHWEST}`, exports.RotationDirection.CLOCKWISE],
    [`${exports.GridLocation.NORTHWEST},${exports.GridLocation.NORTHEAST}`, exports.RotationDirection.CLOCKWISE],
    // Counter-clockwise diagonal rotations
    [`${exports.GridLocation.NORTHEAST},${exports.GridLocation.NORTHWEST}`, exports.RotationDirection.COUNTER_CLOCKWISE],
    [`${exports.GridLocation.NORTHWEST},${exports.GridLocation.SOUTHWEST}`, exports.RotationDirection.COUNTER_CLOCKWISE],
    [`${exports.GridLocation.SOUTHWEST},${exports.GridLocation.SOUTHEAST}`, exports.RotationDirection.COUNTER_CLOCKWISE],
    [`${exports.GridLocation.SOUTHEAST},${exports.GridLocation.NORTHEAST}`, exports.RotationDirection.COUNTER_CLOCKWISE],
    // Dash diagonal movements
    [`${exports.GridLocation.NORTHEAST},${exports.GridLocation.SOUTHWEST}`, "dash"],
    [`${exports.GridLocation.SOUTHEAST},${exports.GridLocation.NORTHWEST}`, "dash"],
    [`${exports.GridLocation.SOUTHWEST},${exports.GridLocation.NORTHEAST}`, "dash"],
    [`${exports.GridLocation.NORTHWEST},${exports.GridLocation.SOUTHEAST}`, "dash"],
    // Static diagonal
    [`${exports.GridLocation.NORTHEAST},${exports.GridLocation.NORTHEAST}`, "static"],
    [`${exports.GridLocation.SOUTHEAST},${exports.GridLocation.SOUTHEAST}`, "static"],
    [`${exports.GridLocation.SOUTHWEST},${exports.GridLocation.SOUTHWEST}`, "static"],
    [`${exports.GridLocation.NORTHWEST},${exports.GridLocation.NORTHWEST}`, "static"],
]);
/**
 * Determine hand rotation direction based on start and end locations
 */
function getHandRotationDirection(startLocation, endLocation) {
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
function getLocationMapForHandRotation(handRotationDir) {
    switch (handRotationDir) {
        case exports.RotationDirection.CLOCKWISE:
            return exports.LOCATION_MAP_CLOCKWISE;
        case exports.RotationDirection.COUNTER_CLOCKWISE:
            return exports.LOCATION_MAP_COUNTER_CLOCKWISE;
        case "dash":
            return exports.LOCATION_MAP_DASH;
        case "static":
            return exports.LOCATION_MAP_STATIC;
        default:
            return exports.LOCATION_MAP_STATIC;
    }
}
/**
 * Grid position to locations map (for diamond grid mode)
 * Maps each grid position to [blueLocation, redLocation]
 */
exports.POSITION_TO_LOCATIONS = {
    // Alpha positions (blue and red at opposite locations)
    [exports.GridPosition.ALPHA1]: [exports.GridLocation.NORTH, exports.GridLocation.SOUTH],
    [exports.GridPosition.ALPHA2]: [exports.GridLocation.NORTHEAST, exports.GridLocation.SOUTHWEST],
    [exports.GridPosition.ALPHA3]: [exports.GridLocation.EAST, exports.GridLocation.WEST],
    [exports.GridPosition.ALPHA4]: [exports.GridLocation.SOUTHEAST, exports.GridLocation.NORTHWEST],
    [exports.GridPosition.ALPHA5]: [exports.GridLocation.SOUTH, exports.GridLocation.NORTH],
    [exports.GridPosition.ALPHA6]: [exports.GridLocation.SOUTHWEST, exports.GridLocation.NORTHEAST],
    [exports.GridPosition.ALPHA7]: [exports.GridLocation.WEST, exports.GridLocation.EAST],
    [exports.GridPosition.ALPHA8]: [exports.GridLocation.NORTHWEST, exports.GridLocation.SOUTHEAST],
    // Beta positions (blue and red at same location)
    [exports.GridPosition.BETA1]: [exports.GridLocation.NORTH, exports.GridLocation.NORTH],
    [exports.GridPosition.BETA2]: [exports.GridLocation.NORTHEAST, exports.GridLocation.NORTHEAST],
    [exports.GridPosition.BETA3]: [exports.GridLocation.EAST, exports.GridLocation.EAST],
    [exports.GridPosition.BETA4]: [exports.GridLocation.SOUTHEAST, exports.GridLocation.SOUTHEAST],
    [exports.GridPosition.BETA5]: [exports.GridLocation.SOUTH, exports.GridLocation.SOUTH],
    [exports.GridPosition.BETA6]: [exports.GridLocation.SOUTHWEST, exports.GridLocation.SOUTHWEST],
    [exports.GridPosition.BETA7]: [exports.GridLocation.WEST, exports.GridLocation.WEST],
    [exports.GridPosition.BETA8]: [exports.GridLocation.NORTHWEST, exports.GridLocation.NORTHWEST],
    // Gamma positions (blue and red at adjacent cardinal locations)
    [exports.GridPosition.GAMMA1]: [exports.GridLocation.NORTH, exports.GridLocation.EAST],
    [exports.GridPosition.GAMMA2]: [exports.GridLocation.NORTH, exports.GridLocation.WEST],
    [exports.GridPosition.GAMMA3]: [exports.GridLocation.EAST, exports.GridLocation.SOUTH],
    [exports.GridPosition.GAMMA4]: [exports.GridLocation.EAST, exports.GridLocation.NORTH],
    [exports.GridPosition.GAMMA5]: [exports.GridLocation.SOUTH, exports.GridLocation.WEST],
    [exports.GridPosition.GAMMA6]: [exports.GridLocation.SOUTH, exports.GridLocation.EAST],
    [exports.GridPosition.GAMMA7]: [exports.GridLocation.WEST, exports.GridLocation.NORTH],
    [exports.GridPosition.GAMMA8]: [exports.GridLocation.WEST, exports.GridLocation.SOUTH],
    [exports.GridPosition.GAMMA9]: [exports.GridLocation.NORTHEAST, exports.GridLocation.SOUTHEAST],
    [exports.GridPosition.GAMMA10]: [exports.GridLocation.NORTHEAST, exports.GridLocation.NORTHWEST],
    [exports.GridPosition.GAMMA11]: [exports.GridLocation.SOUTHEAST, exports.GridLocation.SOUTHWEST],
    [exports.GridPosition.GAMMA12]: [exports.GridLocation.SOUTHEAST, exports.GridLocation.NORTHEAST],
    [exports.GridPosition.GAMMA13]: [exports.GridLocation.SOUTHWEST, exports.GridLocation.NORTHWEST],
    [exports.GridPosition.GAMMA14]: [exports.GridLocation.SOUTHWEST, exports.GridLocation.SOUTHEAST],
    [exports.GridPosition.GAMMA15]: [exports.GridLocation.NORTHWEST, exports.GridLocation.NORTHEAST],
    [exports.GridPosition.GAMMA16]: [exports.GridLocation.NORTHWEST, exports.GridLocation.SOUTHWEST],
};
/**
 * Reverse lookup: locations to position
 */
const LOCATIONS_TO_POSITION = new Map();
for (const [position, [blue, red]] of Object.entries(exports.POSITION_TO_LOCATIONS)) {
    LOCATIONS_TO_POSITION.set(`${blue},${red}`, position);
}
/**
 * Get grid position from blue and red locations
 */
function getGridPositionFromLocations(blueLocation, redLocation) {
    var _a;
    const key = `${blueLocation},${redLocation}`;
    return (_a = LOCATIONS_TO_POSITION.get(key)) !== null && _a !== void 0 ? _a : null;
}
/**
 * Get locations from grid position
 */
function getLocationsFromPosition(position) {
    var _a;
    return (_a = exports.POSITION_TO_LOCATIONS[position]) !== null && _a !== void 0 ? _a : null;
}
//# sourceMappingURL=circular-position-maps.js.map