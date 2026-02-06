/**
 * Arrow Quadrant Calculator Contract
 *
 * Interface for quadrant index calculations for different grid modes and motion types.
 */

import type {
  GridLocation,
  GridMode,
} from "../../../../grid/domain/enums/grid-enums";
import type { MotionType } from "../../../../shared/domain/enums/pictograph-enums";
import type { MotionData } from "../../../../shared/domain/models/MotionData";

export interface IArrowQuadrantCalculator {
  /**
   * Calculate quadrant index for the given motion and arrow location
   */
  calculateQuadrantIndex(motion: MotionData, location: GridLocation): number;

  /**
   * Determine grid mode from motion data
   */
  determineGridMode(motion: MotionData): GridMode;

  /**
   * Check if motion type is a shift motion
   */
  isShiftMotion(motionType: MotionType): boolean;

  /**
   * Calculate diamond grid shift quadrant index
   */
  diamondShiftQuadrantIndex(location: GridLocation): number;

  /**
   * Calculate diamond grid static/dash quadrant index
   */
  diamondStaticDashQuadrantIndex(location: GridLocation): number;

  /**
   * Calculate box grid shift quadrant index
   */
  boxShiftQuadrantIndex(location: GridLocation): number;

  /**
   * Calculate box grid static/dash quadrant index
   */
  boxStaticDashQuadrantIndex(location: GridLocation): number;

  /**
   * Get quadrant mapping for specific grid mode and motion type
   */
  getQuadrantMapping(
    gridMode: GridMode,
    motionType: MotionType
  ): Record<GridLocation, number>;
}
