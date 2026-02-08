/**
 * Grid position calculations
 *
 * Functions for looking up hand point and layer2 point coordinates
 * based on location and grid mode.
 */
import type { Coordinates, GridLocation, GridMode } from "../types.js";
/**
 * Get hand point coordinates for a location and grid mode.
 * This is the core function for prop positioning.
 */
export declare function getHandPointCoordinates(location: GridLocation | string, gridMode: GridMode): Coordinates;
/**
 * Get layer2 point coordinates for a location and grid mode.
 * Used for arrow positioning.
 */
export declare function getLayer2PointCoordinates(location: GridLocation | string, gridMode: GridMode): Coordinates;
