// --- From GlobalAdjustmentKeyGenerator ---
/**
 * Global Adjustment Key Generator Contract
 *
 * Generates composite keys for global arrow adjustment lookup.
 */


/**
 * Options for including prop types in the generated key.
 * Used for saving adjustments at Layer 2 (prop-specific) or Layer 3 (combination).
 */
export interface KeyGeneratorPropOptions {
  /** Prop type for this arrow (lowercase: "staff", "fan", "club", etc.) */
  propType?: string;
  /** Other hand's prop type for Layer 3 combination-specific keys */
  otherPropType?: string;
}

// --- From GlobalArrowAdjustmentRepository ---
/**
 * Global Arrow Adjustment Repository Contract
 *
 * Coordinates state and persistence for global arrow adjustments.
 * Provides the main interface for the rendering pipeline and UI.
 */

import type { Point } from "fabric";
import type {
} from "../domain/GlobalArrowAdjustment";

/**
 * Result of a cascading adjustment lookup.
 * Includes the adjustment point and which layer it was found at.
 */
export interface CascadingLookupResult {
  /** The adjustment offset as a Point */
  adjustment: Point;
  /** Which layer the adjustment was found at: 1 (base), 2 (prop-specific), or 3 (combination) */
  layer: 1 | 2 | 3;
}

