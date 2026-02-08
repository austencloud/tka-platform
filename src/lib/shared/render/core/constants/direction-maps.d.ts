/**
 * Beta offset direction maps
 *
 * When two props end at the same location (a "beta" position),
 * they need to be offset from each other so they don't overlap.
 * The direction of offset depends on:
 * - The location (N/S/E/W vs NE/SE/SW/NW)
 * - The orientation type (radial IN/OUT vs non-radial CLOCK/COUNTER)
 * - The motion color (red vs blue)
 * - For shift motions, the start->end transition
 */
import type { GridLocation, VectorDirection } from "../types.js";
type ColorMap = Record<"blue" | "red", VectorDirection>;
/**
 * Diamond grid (N/S/E/W) - radial orientation (IN/OUT)
 */
export declare const DIAMOND_RADIAL_MAP: Record<GridLocation, ColorMap>;
/**
 * Diamond grid (N/S/E/W) - non-radial orientation (CLOCK/COUNTER)
 */
export declare const DIAMOND_NON_RADIAL_MAP: Record<GridLocation, ColorMap>;
/**
 * Box grid (NE/SE/SW/NW) - radial orientation
 */
export declare const BOX_RADIAL_MAP: Record<GridLocation, ColorMap>;
/**
 * Box grid (NE/SE/SW/NW) - non-radial orientation (CLOCK/COUNTER)
 * Also used for interradial orientations (clockIn/clockOut/counterIn/counterOut)
 * as a close approximation — both are perpendicular-ish to the radial axis.
 */
export declare const BOX_NON_RADIAL_MAP: Record<GridLocation, ColorMap>;
/**
 * Shift motion transitions - radial orientation
 * Maps [startLocation][endLocation] -> direction
 */
export declare const SHIFT_RADIAL_MAP: Record<GridLocation, Partial<Record<GridLocation, VectorDirection>>>;
/**
 * Shift motion transitions - non-radial orientation
 */
export declare const SHIFT_NON_RADIAL_MAP: Record<GridLocation, Partial<Record<GridLocation, VectorDirection>>>;
export declare const OPPOSITE_DIRECTIONS: Record<VectorDirection, VectorDirection>;
export {};
