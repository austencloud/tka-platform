/**
 * Arrow Adjustment Calculator Interface
 *
 * Calculates position adjustments for arrows based on placement rules.
 */

import type { GridLocation } from "../../../../../grid/domain/enums/grid-enums";
import type { PictographData } from "../../../../../shared/domain/models/PictographData";
import type { MotionData } from "../../../../../shared/domain/models/MotionData";
import type { Point } from "fabric";
import type { PipelineDiagnostics } from "../../domain/PipelineDiagnostics";

export interface IArrowAdjustmentCalculator {
  /**
   * Calculate position adjustment for arrow based on placement rules.
   */
  calculateAdjustment(
    pictographData: PictographData,
    motionData: MotionData,
    letter: string,
    location: GridLocation,
    arrowColor?: string
  ): Promise<Point>;

  /**
   * Get the base adjustment (before directional tuple transformation).
   * This is useful for the WASD adjustment panel to get the same base value
   * that the rendering pipeline uses.
   */
  getBaseAdjustmentPublic(
    pictographData: PictographData,
    motionData: MotionData,
    letter: string,
    arrowColor?: string
  ): Promise<Point>;

  /**
   * Probe all 4 tiers of the arrow positioning pipeline without short-circuiting.
   * Returns rich metadata about which tier is active and what values each tier has.
   * Useful for the WASD adjustment panel to show the full pipeline state.
   */
  getDiagnostics(
    pictographData: PictographData,
    motionData: MotionData,
    letter: string,
    location: GridLocation,
    arrowColor?: string
  ): Promise<PipelineDiagnostics>;
}
