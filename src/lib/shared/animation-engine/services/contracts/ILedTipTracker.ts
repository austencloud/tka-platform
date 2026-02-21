/**
 * ILedTipTracker
 *
 * Tracks LED point positions across frames and computes
 * velocity vectors via finite differencing for trail direction.
 * Also applies the pattern engine to determine per-LED colors.
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

export interface ILedTipTracker {
	/**
	 * Update LED positions, compute velocities, and evaluate pattern colors
	 * for the current frame.
	 */
	update(
		blueProp: PropState | null,
		redProp: PropState | null,
		config: LedTipTrackerConfig,
		currentTime: number,
		ledConfig: LedOverlayConfig
	): LedTipData[];

	/**
	 * Reset stored positions (e.g., on sequence change).
	 */
	reset(): void;
}
