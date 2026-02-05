/**
 * Arrow Path Resolution Service Interface
 */

import type { ArrowPlacementData } from "../../../positioning/placement/domain/ArrowPlacementData";
import type { MotionData } from "../../../../shared/domain/models/MotionData";

export interface IArrowPathResolver {
  /**
   * Get arrow SVG path based on motion type and properties
   */
  getArrowPath(
    arrowData: ArrowPlacementData,
    motionData: MotionData
  ): string | null;

  /**
   * Get the correct arrow SVG path based on motion data (optimized version)
   */
  getArrowSvgPath(motionData: MotionData | undefined): string;
}
