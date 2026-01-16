/**
 * Global Adjustment Key Generator Contract
 *
 * Generates composite keys for global arrow adjustment lookup.
 */

import type { MotionData } from "../../../../../shared/domain/models/MotionData";
import type { PictographData } from "../../../../../shared/domain/models/PictographData";
import type { GlobalAdjustmentKey } from "../../domain/GlobalArrowAdjustment";

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

export interface IGlobalAdjustmentKeyGenerator {
  /**
   * Generate a global adjustment key from motion and pictograph data.
   *
   * @param motionData The motion data for the arrow
   * @param pictographData The pictograph containing the motion
   * @param arrowKey The arrow identifier (color: "blue", "red" or type: "pro", "anti")
   * @param options Optional prop types for Layer 2/3 keys
   * @returns GlobalAdjustmentKey for lookup
   */
  generateKey(
    motionData: MotionData,
    pictographData: PictographData,
    arrowKey: string,
    options?: KeyGeneratorPropOptions
  ): GlobalAdjustmentKey;
}
