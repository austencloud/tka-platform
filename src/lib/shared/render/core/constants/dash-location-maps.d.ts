/**
 * Dash arrow location maps
 *
 * Dash arrows are NOT placed at their start or end locations.
 * Instead, their location is calculated based on the motion parameters.
 */
import type { GridLocation } from "../types.js";
export declare const PHI_DASH_PSI_DASH_LOCATION_MAP: Record<string, GridLocation>;
export declare const LAMBDA_ZERO_TURNS_LOCATION_MAP: Record<string, GridLocation>;
export declare const DEFAULT_ZERO_TURNS_DASH_LOCATION_MAP: Record<string, GridLocation>;
export declare const NON_ZERO_TURNS_DASH_LOCATION_MAP: Record<string, Record<GridLocation, GridLocation>>;
/**
 * Diamond mode Type3 dash location map
 */
export declare const DIAMOND_DASH_LOCATION_MAP: Record<string, GridLocation>;
/**
 * Box mode Type3 dash location map
 */
export declare const BOX_DASH_LOCATION_MAP: Record<string, GridLocation>;
export declare const PHI_DASH_LETTERS: string[];
export declare const PSI_DASH_LETTERS: string[];
export declare const LAMBDA_LETTERS: string[];
export declare const LAMBDA_DASH_LETTERS: string[];
export declare const TYPE3_LETTERS: string[];
export declare const OPPOSITE_LOCATION_MAP: Record<GridLocation, GridLocation>;
