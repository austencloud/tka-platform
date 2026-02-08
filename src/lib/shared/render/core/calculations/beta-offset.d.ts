/**
 * Beta offset calculator
 *
 * When two props end at the same location (a "beta" position),
 * they need to be offset from each other so they don't overlap.
 */
import type { GridMode } from "../types.js";
export interface BetaMotionInput {
    startLocation: string;
    endLocation: string;
    endOrientation?: string;
    motionType: string;
    color: "blue" | "red";
    propType?: string;
}
export interface BetaOffsetInput {
    blueMotion: BetaMotionInput;
    redMotion: BetaMotionInput;
    letter: string;
    gridMode: GridMode;
}
/**
 * Calculate beta offset for a single motion
 * Returns { x, y } pixel offset to apply to prop position
 */
export declare function calculateBetaOffset(input: BetaOffsetInput, targetMotion: BetaMotionInput): {
    x: number;
    y: number;
};
