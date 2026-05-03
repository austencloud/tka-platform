/**
 * LED Tip Tracker Types
 *
 * Co-exported types for tracking LED point positions.
 */

import type { LedTipData, LedOverlayConfig } from "../../domain/types/LedTypes";
import type { PropState } from "../../domain/PropState";
import type { PropDimensions } from "./IAnimationRenderLoop";

export interface LedTipTrackerConfig {
	canvasSize: number;
	bluePropDimensions: PropDimensions;
	redPropDimensions: PropDimensions;
	bluePropType?: string;
	redPropType?: string;
}

