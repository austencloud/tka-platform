/**
 * IFireTipTracker
 *
 * Tracks prop endpoint positions across frames and computes
 * velocity vectors via finite differencing for fire direction/intensity.
 */

import type { PropTipData } from "../../domain/types/FireTypes";
import type { PropState } from "../../domain/PropState";
import type { PropDimensions } from "./IAnimationRenderLoop";

export interface FireTipTrackerConfig {
  canvasSize: number;
  bluePropDimensions: PropDimensions;
  redPropDimensions: PropDimensions;
  bluePropType?: string;
  redPropType?: string;
}

export interface IFireTipTracker {
  /**
   * Update tip positions and compute velocities for the current frame.
   * @param blueProp - Current blue prop state (null if hidden)
   * @param redProp - Current red prop state (null if hidden)
   * @param config - Canvas size and prop dimensions for endpoint calculation
   * @param currentTime - performance.now() timestamp
   * @returns Array of tip data with positions and velocities
   */
  update(
    blueProp: PropState | null,
    redProp: PropState | null,
    config: FireTipTrackerConfig,
    currentTime: number
  ): PropTipData[];

  /**
   * Reset stored positions (e.g., on sequence change).
   */
  reset(): void;
}
