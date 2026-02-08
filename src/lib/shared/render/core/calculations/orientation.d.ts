/**
 * Orientation calculator
 *
 * Calculates end orientation based on motion type, turns, rotation direction,
 * and start orientation. This is foundational for valid pictograph generation.
 */
import type { HandPath, Orientation } from "../types.js";
/**
 * Get handpath direction from start/end locations
 */
export declare function getHandpathDirection(startLocation: string, endLocation: string): HandPath;
/**
 * Switch orientation: IN↔OUT, CLOCK↔COUNTER, CENTER_N↔CENTER_S, etc.
 */
export declare function switchOrientation(ori: Orientation): Orientation;
export interface OrientationInput {
    motionType: string;
    turns?: number | "fl";
    rotationDirection: string;
    startLocation: string;
    endLocation: string;
    startOrientation?: string;
}
/**
 * Calculate end orientation from motion data.
 *
 * @param input - Motion data including type, turns, rotation direction, locations
 * @returns Calculated end orientation
 */
export declare function calculateEndOrientation(input: OrientationInput): Orientation;
/**
 * Calculate both start and end orientations for a motion.
 * Start orientation defaults to IN (the universal starting orientation).
 *
 * @param input - Motion data
 * @returns Object with startOrientation and calculated endOrientation
 */
export declare function calculateOrientations(input: OrientationInput): {
    startOrientation: Orientation;
    endOrientation: Orientation;
};
