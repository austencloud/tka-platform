/**
 * Arrow placement calculations
 *
 * Calculates arrow location and position based on motion type,
 * start/end locations, and grid mode.
 */
import type { ArrowPlacement, Coordinates, GridLocation, GridMode, MotionType } from "../types.js";
/**
 * Calculate arrow location based on motion type and start/end locations
 */
export declare function calculateArrowLocation(motionType: MotionType | string, startLocation: GridLocation | string, endLocation: GridLocation | string): GridLocation;
/**
 * Calculate arrow position (uses layer2 points for proper spacing)
 */
export declare function calculateArrowPosition(location: GridLocation | string, gridMode: GridMode): Coordinates;
/**
 * Calculate complete arrow placement (location, position, rotation)
 */
export declare function calculateArrowPlacement(motionType: MotionType | string, startLocation: GridLocation | string, endLocation: GridLocation | string, rotationDirection: string, gridMode: GridMode, isRadialOrientation?: boolean): ArrowPlacement;
