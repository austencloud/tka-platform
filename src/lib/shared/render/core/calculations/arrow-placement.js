/**
 * Arrow placement calculations
 *
 * Calculates arrow location and position based on motion type,
 * start/end locations, and grid mode.
 */
import { getLayer2PointCoordinates } from "./grid-position.js";
import { calculateArrowRotation } from "./arrow-rotation.js";
// ============================================================================
// ARROW LOCATION CALCULATION
// ============================================================================
/**
 * Direction pairs mapping for shift arrows (PRO/ANTI/FLOAT)
 * Maps start/end location pairs to their calculated arrow location
 */
function createLocationPairKey(locations) {
    // Sort locations to ensure consistent key regardless of order
    const sortedLocations = [...locations].sort();
    return sortedLocations.join(",");
}
const shiftDirectionPairs = {
    // Cardinal + Adjacent Cardinal combinations (normal shifts)
    [createLocationPairKey(["n", "e"])]: "ne",
    [createLocationPairKey(["e", "s"])]: "se",
    [createLocationPairKey(["s", "w"])]: "sw",
    [createLocationPairKey(["w", "n"])]: "nw",
    // Adjacent Intercardinal combinations (normal shifts)
    [createLocationPairKey(["ne", "nw"])]: "n",
    [createLocationPairKey(["ne", "se"])]: "e",
    [createLocationPairKey(["sw", "se"])]: "s",
    [createLocationPairKey(["nw", "sw"])]: "w",
    // SKEWED motion combinations (cardinal ↔ non-adjacent intercardinal)
    [createLocationPairKey(["w", "ne"])]: "n",
    [createLocationPairKey(["w", "se"])]: "s",
    [createLocationPairKey(["n", "se"])]: "e",
    [createLocationPairKey(["n", "sw"])]: "w",
    [createLocationPairKey(["e", "sw"])]: "s",
    [createLocationPairKey(["e", "nw"])]: "n",
    [createLocationPairKey(["s", "nw"])]: "w",
    [createLocationPairKey(["s", "ne"])]: "e",
};
/**
 * Calculate arrow location based on motion type and start/end locations
 */
export function calculateArrowLocation(motionType, startLocation, endLocation) {
    const normalizedMotionType = (typeof motionType === "string" ? motionType.toLowerCase() : motionType);
    const normalizedStartLoc = (typeof startLocation === "string" ? startLocation.toLowerCase() : startLocation);
    const normalizedEndLoc = (typeof endLocation === "string" ? endLocation.toLowerCase() : endLocation);
    switch (normalizedMotionType) {
        case "static":
            // Static arrows use their start location directly
            return normalizedStartLoc;
        case "pro":
        case "anti":
        case "float":
            // Shift arrows use location pair mapping
            const locationPairKey = createLocationPairKey([normalizedStartLoc, normalizedEndLoc]);
            return shiftDirectionPairs[locationPairKey] ?? normalizedStartLoc;
        case "dash":
            // For simplicity, dash uses end location
            // (full implementation uses DashLocationCalculator)
            return normalizedEndLoc;
        default:
            return normalizedStartLoc;
    }
}
/**
 * Calculate arrow position (uses layer2 points for proper spacing)
 */
export function calculateArrowPosition(location, gridMode) {
    return getLayer2PointCoordinates(location, gridMode);
}
/**
 * Calculate complete arrow placement (location, position, rotation)
 */
export function calculateArrowPlacement(motionType, startLocation, endLocation, rotationDirection, gridMode, isRadialOrientation) {
    // Step 1: Calculate arrow location
    const location = calculateArrowLocation(motionType, startLocation, endLocation);
    // Step 2: Calculate position from location
    const position = calculateArrowPosition(location, gridMode);
    // Step 3: Calculate rotation
    const rotation = calculateArrowRotation(motionType, location, rotationDirection, startLocation, endLocation, isRadialOrientation);
    return {
        x: position.x,
        y: position.y,
        rotation,
        location,
    };
}
