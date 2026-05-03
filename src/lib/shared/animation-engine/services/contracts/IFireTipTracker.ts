/**
 * Fire Tip Tracker Types
 *
 * Co-exported types for tracking prop endpoint positions across frames.
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

