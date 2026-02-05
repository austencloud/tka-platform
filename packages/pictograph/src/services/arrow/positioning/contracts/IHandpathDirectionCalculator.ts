import type { GridLocation } from "@tka/types";

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
export interface IHandpathDirectionCalculator {
  calculateDirection(
    startLocation: GridLocation,
    endLocation: GridLocation
  ): HandpathDirection;
}
