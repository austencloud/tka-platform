/**
 * IFireTipTracker
 *
 * Tracks prop endpoint positions across frames and computes
 * velocity vectors via finite differencing for fire direction/intensity.
 */

import type { PropTipData, RenderedPropTransform } from "../../domain/types/FireTypes";
import type { PropState } from "../../domain/PropState";
import type { PropDimensions } from "./IAnimationRenderLoop";

export interface FireTipTrackerConfig {
  canvasSize: number;
  bluePropDimensions: PropDimensions;
  redPropDimensions: PropDimensions;
  bluePropType?: string;
  redPropType?: string;
  /** Transforms from the Canvas2D renderer. When provided, used instead of recomputing positions. */
  renderedTransforms?: {
    blue: RenderedPropTransform | null;
    red: RenderedPropTransform | null;
  };
}

export interface FireTipUpdateResult {
  tips: PropTipData[];
  /** True when a time gap was detected (HMR, tab switch, frame drop). Caller should clear the fire simulation. */
  gapDetected: boolean;
}

export interface IFireTipTracker {
  /**
   * Update tip positions and compute velocities for the current frame.
   * @param blueProp - Current blue prop state (null if hidden)
   * @param redProp - Current red prop state (null if hidden)
   * @param config - Canvas size and prop dimensions for endpoint calculation
   * @param currentTime - performance.now() timestamp
   * @returns Tip data with positions/velocities, plus a gap-detected flag
   */
  update(
    blueProp: PropState | null,
    redProp: PropState | null,
    config: FireTipTrackerConfig,
    currentTime: number
  ): FireTipUpdateResult;

  /**
   * Reset stored positions (e.g., on sequence change).
   */
  reset(): void;
}
