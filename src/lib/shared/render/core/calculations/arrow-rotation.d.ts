/**
 * Arrow rotation calculations
 *
 * Calculates arrow rotation angle based on motion type, location,
 * and rotation direction.
 */
import type { GridLocation, MotionType } from "../types.js";
/**
 * Calculate arrow rotation angle
 */
export declare function calculateArrowRotation(motionType: MotionType | string, location: GridLocation | string, rotationDirection: string, startLocation?: GridLocation | string, endLocation?: GridLocation | string, isRadialOrientation?: boolean): number;
