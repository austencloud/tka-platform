/**
 * Prop placement calculations
 *
 * Calculates prop position (x, y) and rotation angle based on
 * grid location, orientation, and grid mode.
 */
import type { Coordinates, GridLocation, GridMode, Orientation, PropPlacement } from "../types.js";
/**
 * Calculate prop rotation angle based on location, orientation, and grid mode
 */
export declare function calculatePropRotation(location: GridLocation | string, orientation: Orientation | string, gridMode: GridMode): number;
/**
 * Calculate prop position (x, y coordinates)
 */
export declare function calculatePropPosition(location: GridLocation | string, gridMode: GridMode): Coordinates;
/**
 * Calculate complete prop placement (position + rotation)
 */
export declare function calculatePropPlacement(location: GridLocation | string, orientation: Orientation | string, gridMode: GridMode): PropPlacement;
