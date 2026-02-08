/**
 * Prop placement calculations
 *
 * Calculates prop position (x, y) and rotation angle based on
 * grid location, orientation, and grid mode.
 */
import { isCardinal } from "../types.js";
import { getHandPointCoordinates } from "./grid-position.js";
import { DIAMOND_PROP_ANGLES, BOX_PROP_ANGLES } from "../constants/rotation-maps.js";
/**
 * Get the appropriate angle map based on grid mode and location
 */
function getAngleMapForLocation(location, gridMode) {
    if (gridMode === "diamond") {
        return DIAMOND_PROP_ANGLES;
    }
    if (gridMode === "skewed") {
        // In skewed mode, use diamond angles for cardinal, box for intercardinal
        return isCardinal(location) ? DIAMOND_PROP_ANGLES : BOX_PROP_ANGLES;
    }
    // BOX mode or default
    return BOX_PROP_ANGLES;
}
/**
 * Calculate prop rotation angle based on location, orientation, and grid mode
 */
export function calculatePropRotation(location, orientation, gridMode) {
    const normalizedLocation = location.toLowerCase();
    const normalizedOrientation = orientation.toLowerCase();
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
export function calculatePropPosition(location, gridMode) {
    return getHandPointCoordinates(location, gridMode);
}
/**
 * Calculate complete prop placement (position + rotation)
 */
export function calculatePropPlacement(location, orientation, gridMode) {
    const position = calculatePropPosition(location, gridMode);
    const rotation = calculatePropRotation(location, orientation, gridMode);
    return {
        x: position.x,
        y: position.y,
        rotation,
    };
}
