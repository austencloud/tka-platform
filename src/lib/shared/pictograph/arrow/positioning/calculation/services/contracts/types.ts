// --- From ArrowLocator ---
/**
 * Arrow Location Service Contract
 *
 * Determines arrow location based on start and end positions using the same logic
 * as the desktop app's ShiftLocationCalculator.
 */

export interface ArrowLocationInput {
  startLocation: string;
  endLocation: string;
  motionType: string;
}

// --- From DirectionalTupleGenerator ---
/**
 * Directional Tuple Service Contracts
 *
 * Handles complex directional tuple processing for arrow positioning adjustments.
 * Direct TypeScript port of the Python DirectionalTupleProcessor.
 */

// --- From HandpathDirectionCalculator ---

/**
 * Handpath direction types.
 *
 * - cw: Clockwise handpath movement
 * - ccw: Counter-clockwise handpath movement
 * - dash: Straight line movement across the grid
 * - static: No movement (same start and end location)
 */
export type HandpathDirection = "cw" | "ccw" | "dash" | "static";

/**
 * Service for calculating handpath direction based on start and end locations.
 *
 * Handpath direction is independent of prop rotation direction and is determined
 * purely by the spatial relationship between start and end locations.
 *
 * Used primarily for FLOAT arrow rotation calculations.
 */

