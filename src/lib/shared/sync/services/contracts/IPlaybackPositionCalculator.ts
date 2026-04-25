/**
 * Playback Position Calculator Contract
 *
 * Calculates the current playback position from a PlaybackIntent.
 * This enables frame-accurate sync without constant network messages.
 */

import type { PlaybackIntent } from '../../domain/sync-types';

/**
 * Result of a position calculation.
 */
export interface PositionResult {
	/** The calculated step (may be fractional during animation) */
	step: number;

	/** The integer beat number (for step grid display) */
	beat: number;

	/** Progress within the current beat (0.0 to 1.0) */
	beatProgress: number;

	/** Whether playback has reached the end */
	isAtEnd: boolean;

	/** Whether playback is looping */
	isLooping: boolean;
}

/**
 * Interface for calculating playback position from intent.
 */
export interface IPlaybackPositionCalculator {
	/**
	 * Calculate the current position from a playback intent.
	 *
	 * Uses the deterministic equation:
	 * step = anchorStep + ((now - anchorWallTime) / beatDuration) * speed
	 *
	 * @param intent - The current playback intent
	 * @param nowMs - Current wall time in milliseconds
	 * @returns The calculated position
	 */
	calculatePosition(intent: PlaybackIntent, nowMs: number): PositionResult;

	/**
	 * Calculate position with drift correction applied.
	 *
	 * When syncing across devices, small timing differences cause drift.
	 * This method smoothly corrects toward the target position without jarring jumps.
	 *
	 * @param intent - The current playback intent
	 * @param nowMs - Current wall time in milliseconds
	 * @param lastRenderedStep - The step we rendered last frame
	 * @param maxCorrectionPerFrame - Maximum adjustment per frame (default: 0.1 steps)
	 * @returns The corrected position
	 */
	calculateCorrectedPosition(
		intent: PlaybackIntent,
		nowMs: number,
		lastRenderedStep: number,
		maxCorrectionPerFrame?: number
	): PositionResult;

	/**
	 * Calculate what the anchor step should be for a given target position.
	 *
	 * Used when creating a new intent (e.g., seeking to a position).
	 *
	 * @param targetStep - The desired step position
	 * @param nowMs - Current wall time
	 * @returns The anchor step to use in the new intent
	 */
	calculateAnchorForTarget(targetStep: number, nowMs: number): number;

	/**
	 * Set the beat duration for calculations.
	 * This should be updated when BPM changes.
	 *
	 * @param durationMs - Duration of one beat in milliseconds
	 */
	setStepDuration(durationMs: number): void;

	/**
	 * Get the current beat duration.
	 */
	readonly beatDurationMs: number;
}
