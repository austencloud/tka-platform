/**
 * Dash location calculator
 *
 * Dash arrows are NOT placed at their start or end locations.
 * Instead, their location is calculated based on the motion parameters.
 */
import type { GridLocation, GridMode } from "../types.js";
export interface DashLocationInput {
    letter: string;
    motionColor: "blue" | "red";
    motionStartLocation: string;
    motionEndLocation: string;
    motionTurns: number | "fl" | undefined;
    motionRotationDirection: string;
    otherMotionType?: string;
    otherMotionStartLocation?: string;
    otherMotionEndLocation?: string;
    otherMotionTurns?: number | "fl" | undefined;
    otherMotionRotationDirection?: string;
    gridMode: GridMode;
}
/**
 * Calculate the location where a dash arrow should be placed.
 * This is NOT the same as start or end location.
 */
export declare function calculateDashLocation(input: DashLocationInput): GridLocation;
