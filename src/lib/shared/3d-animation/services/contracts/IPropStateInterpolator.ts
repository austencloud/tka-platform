/**
 * IPropStateInterpolator Contract
 *
 * Service for calculating PropState3D from MotionConfig3D and progress.
 * Core animation interpolation logic.
 */

import type { PropState3D } from "../../domain/models/PropState3D";
import type { MotionConfig3D } from "../../domain/models/MotionData3D";

export interface IPropStateInterpolator {
  /**
   * Calculate PropState3D from config and progress
   *
   * Handles all motion types and plane transformations.
   * Progress is 0-1 representing animation completion.
   *
   * @param config - Motion configuration
   * @param progress - Animation progress (0-1)
   * @returns Computed prop state with 3D position and rotation
   */
  calculatePropState(config: MotionConfig3D, progress: number): PropState3D;
}
