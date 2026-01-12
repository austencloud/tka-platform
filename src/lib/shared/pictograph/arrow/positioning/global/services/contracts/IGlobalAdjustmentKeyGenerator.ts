/**
 * Global Adjustment Key Generator Contract
 *
 * Generates composite keys for global arrow adjustment lookup.
 */

import type { MotionData } from "../../../../../shared/domain/models/MotionData";
import type { PictographData } from "../../../../../shared/domain/models/PictographData";
import type { GlobalAdjustmentKey } from "../../domain/GlobalArrowAdjustment";

export interface IGlobalAdjustmentKeyGenerator {
  /**
   * Generate a global adjustment key from motion and pictograph data
   *
   * @param motionData The motion data for the arrow
   * @param pictographData The pictograph containing the motion
   * @param arrowKey The arrow identifier (color: "blue", "red" or type: "pro", "anti")
   * @returns GlobalAdjustmentKey for lookup
   */
  generateKey(
    motionData: MotionData,
    pictographData: PictographData,
    arrowKey: string
  ): GlobalAdjustmentKey;
}
