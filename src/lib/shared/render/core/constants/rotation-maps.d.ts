/**
 * Prop and arrow rotation angle maps
 *
 * Exact values from the original PropRotAngleManager.ts and ProAntiRotationMaps.ts
 */
import type { GridLocation, Orientation } from "../types.js";
/**
 * Diamond grid rotation angles by orientation and location
 */
export declare const DIAMOND_PROP_ANGLES: Record<Orientation, Record<GridLocation, number>>;
/**
 * Box grid rotation angles by orientation and location
 */
export declare const BOX_PROP_ANGLES: Record<Orientation, Record<GridLocation, number>>;
/**
 * PRO rotation maps
 */
export declare const PRO_CLOCKWISE_MAP: Record<GridLocation, number>;
export declare const PRO_COUNTER_CLOCKWISE_MAP: Record<GridLocation, number>;
/**
 * ANTI rotation maps
 * ANTI clockwise = PRO counter-clockwise
 * ANTI counter-clockwise = PRO clockwise
 */
export declare const ANTI_CLOCKWISE_MAP: Record<GridLocation, number>;
export declare const ANTI_COUNTER_CLOCKWISE_MAP: Record<GridLocation, number>;
/**
 * STATIC rotation maps - radial (IN/OUT) orientations
 */
export declare const STATIC_RADIAL_CLOCKWISE_MAP: Record<GridLocation, number>;
export declare const STATIC_RADIAL_COUNTER_CLOCKWISE_MAP: Record<GridLocation, number>;
/**
 * STATIC rotation maps - non-radial (CLOCK/COUNTER) orientations
 */
export declare const STATIC_NON_RADIAL_CLOCKWISE_MAP: Record<GridLocation, number>;
export declare const STATIC_NON_RADIAL_COUNTER_CLOCKWISE_MAP: Record<GridLocation, number>;
/**
 * DASH rotation maps
 *
 * IMPORTANT: Both CW and CCW maps are IDENTICAL for dash arrows!
 * The rotation angle is based purely on the arrow's location (pointing outward).
 * The CW/CCW only affects mirroring, not the rotation angle itself.
 */
export declare const DASH_CLOCKWISE_MAP: Record<GridLocation, number>;
export declare const DASH_COUNTER_CLOCKWISE_MAP: Record<GridLocation, number>;
/**
 * DASH no-rotation map (special case for straight dashes)
 * Key format: "startLocation,endLocation" (lowercase)
 */
export declare const DASH_NO_ROTATION_MAP: Record<string, number>;
/**
 * FLOAT rotation maps (same as PRO but uses handpath direction)
 */
export declare const FLOAT_CLOCKWISE_MAP: Record<GridLocation, number>;
export declare const FLOAT_COUNTER_CLOCKWISE_MAP: Record<GridLocation, number>;
