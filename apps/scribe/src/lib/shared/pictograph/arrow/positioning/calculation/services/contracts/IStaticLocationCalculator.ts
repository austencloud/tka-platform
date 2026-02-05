/**
 * Static Location Calculator Contract
 *
 * Handles location calculation for static motions.
 * Returns the arrow location for motions that don't change position.
 */

import type { GridLocation } from "../../../../../grid/domain/enums/grid-enums";
import type { MotionData } from "../../../../../shared/domain/models/MotionData";

export interface IStaticLocationCalculator {
  /**
   * Calculate the arrow location for a static motion
   * @param motion The motion data containing start location
   * @returns The grid location where the arrow should be positioned
   */
  calculateLocation(motion: MotionData): GridLocation;
}
