/**
 * Playback Position Calculator
 *
 * Calculates the current playback position from a PlaybackIntent using
 * the deterministic playback equation:
 *
 *   step = anchorStep + ((now - anchorWallTime) / beatDuration) * speed
 *
 * This enables frame-accurate synchronization across devices without
 * requiring constant network messages during playback.
 */

import type { PlaybackIntent } from '../domain/sync-types';
import type { PositionResult } from "./types";

/** Default beat duration (60 BPM = 1000ms per beat) */
const DEFAULT_BEAT_DURATION_MS = 1000;

/** Minimum drift threshold below which we ignore corrections */
const MIN_DRIFT_THRESHOLD = 0.01;

/** Default snap threshold - drift above this causes immediate jump */
const DEFAULT_SNAP_THRESHOLD = 1.0;

/** Default maximum correction per frame during smooth sync */
const DEFAULT_MAX_CORRECTION = 0.1;

/**
 * Calculator for determining playback position from a PlaybackIntent.
 *
 * The core algorithm is deterministic: given the same intent and timestamp,
 * every device will calculate the same position. This eliminates sync drift
 * without requiring constant network communication.
 */
export class PlaybackPositionCalculator {
	private _beatDurationMs: number = DEFAULT_BEAT_DURATION_MS;

	/**
	 * Get the current beat duration in milliseconds.
	 */
	get beatDurationMs(): number {
		return this._beatDurationMs;
	}

	/**
	 * Calculate the current position from a playback intent.
	 *
	 * Uses the deterministic equation:
	 * step = anchorStep + ((now - anchorWallTime) / beatDuration) * speed
	 *
	 * @param intent - The current playback intent
	 * @param nowMs - Current wall time in milliseconds
	 * @returns The calculated position result
	 */
	calculatePosition(intent: PlaybackIntent, nowMs: number): PositionResult {
		// Handle edge case: no steps in sequence
		if (intent.totalSteps <= 0) {
			return this.createPositionResult(0, 0, true, false);
		}

		// When paused or speed is zero, return the anchor position
		if (!intent.playing || intent.speed === 0) {
			const step = this.clampStep(intent.anchorStep, intent.totalSteps);
			const isAtEnd = step >= intent.totalSteps - 1;
			return this.createPositionResult(step, intent.totalSteps, isAtEnd, false);
		}

		// Calculate elapsed time since anchor (clamp negative to zero for clock drift)
		const elapsedMs = Math.max(0, nowMs - intent.anchorWallTime);

		// Calculate beats elapsed (fractional)
		const beatsElapsed = (elapsedMs / this._beatDurationMs) * intent.speed;

		// Calculate raw step position
		const rawStep = intent.anchorStep + beatsElapsed;

		// Handle looping and bounds
		const { step, isAtEnd, isLooping } = this.resolveStepBounds(
			rawStep,
			intent.totalSteps,
			intent.loop
		);

		return this.createPositionResult(step, intent.totalSteps, isAtEnd, isLooping);
	}

	/**
	 * Calculate position with smooth drift correction applied.
	 *
	 * When syncing across devices, small timing differences cause drift.
	 * This method smoothly corrects toward the target position without
	 * jarring jumps, unless the drift exceeds the snap threshold.
	 *
	 * @param intent - The current playback intent
	 * @param nowMs - Current wall time in milliseconds
	 * @param lastRenderedStep - The step we rendered last frame
	 * @param maxCorrectionPerFrame - Maximum adjustment per frame (default: 0.1 steps)
	 * @returns The corrected position result
	 */
	calculateCorrectedPosition(
		intent: PlaybackIntent,
		nowMs: number,
		lastRenderedStep: number,
		maxCorrectionPerFrame: number = DEFAULT_MAX_CORRECTION
	): PositionResult {
		// Get the target position from the intent
		const targetResult = this.calculatePosition(intent, nowMs);

		// If paused, just return the target (no drift to correct)
		if (!intent.playing || intent.speed === 0) {
			return targetResult;
		}

		// Calculate drift between where we are and where we should be
		const drift = targetResult.step - lastRenderedStep;
		const absDrift = Math.abs(drift);

		// Ignore tiny drift (below threshold)
		if (absDrift < MIN_DRIFT_THRESHOLD) {
			return this.createPositionResult(
				lastRenderedStep,
				intent.totalSteps,
				targetResult.isAtEnd,
				targetResult.isLooping
			);
		}

		// If drift is large, snap immediately to target
		if (absDrift > DEFAULT_SNAP_THRESHOLD) {
			return targetResult;
		}

		// Smoothly ease toward target
		const correction = Math.sign(drift) * Math.min(absDrift, maxCorrectionPerFrame);
		const correctedStep = lastRenderedStep + correction;

		// Clamp the corrected step to valid bounds
		const clampedStep = this.clampStep(correctedStep, intent.totalSteps);

		return this.createPositionResult(
			clampedStep,
			intent.totalSteps,
			targetResult.isAtEnd,
			targetResult.isLooping
		);
	}

	/**
	 * Calculate what the anchor step should be for a given target position.
	 *
	 * When creating a new intent (e.g., seeking to a position), the anchor
	 * step is simply the target position at the moment of intent creation.
	 *
	 * @param targetStep - The desired step position
	 * @param _nowMs - Current wall time (unused, included for interface compliance)
	 * @returns The anchor step to use in the new intent
	 */
	calculateAnchorForTarget(targetStep: number, _nowMs: number): number {
		return targetStep;
	}

	/**
	 * Set the beat duration for calculations.
	 * This should be updated when BPM changes.
	 *
	 * @param durationMs - Duration of one beat in milliseconds
	 * @throws Error if duration is not positive
	 */
	setStepDuration(durationMs: number): void {
		if (durationMs <= 0) {
			throw new Error(`Beat duration must be positive, got: ${durationMs}`);
		}
		this._beatDurationMs = durationMs;
	}

	/**
	 * Resolve step position with looping and bounds handling.
	 *
	 * @param rawStep - The calculated raw step (may be out of bounds)
	 * @param totalSteps - Total number of steps in the sequence
	 * @param loop - Whether looping is enabled
	 * @returns Resolved step, end flag, and looping flag
	 */
	private resolveStepBounds(
		rawStep: number,
		totalSteps: number,
		loop: boolean
	): { step: number; isAtEnd: boolean; isLooping: boolean } {
		const maxStep = totalSteps - 1;

		// Handle reverse playback (negative position)
		if (rawStep < 0) {
			if (loop) {
				// Wrap around to end when going backwards
				const wrapped = ((rawStep % totalSteps) + totalSteps) % totalSteps;
				return { step: wrapped, isAtEnd: false, isLooping: true };
			}
			// Clamp to start
			return { step: 0, isAtEnd: false, isLooping: false };
		}

		// Handle forward playback past end
		if (rawStep >= totalSteps) {
			if (loop) {
				// Wrap around to beginning
				const wrapped = rawStep % totalSteps;
				return { step: wrapped, isAtEnd: false, isLooping: true };
			}
			// Clamp to end
			return { step: maxStep, isAtEnd: true, isLooping: false };
		}

		// Within bounds
		const isAtEnd = rawStep >= maxStep;
		return { step: rawStep, isAtEnd, isLooping: false };
	}

	/**
	 * Clamp a step value to valid bounds.
	 *
	 * @param step - The step value to clamp
	 * @param totalSteps - Total number of steps
	 * @returns Clamped step value
	 */
	private clampStep(step: number, totalSteps: number): number {
		if (totalSteps <= 0) return 0;
		return Math.max(0, Math.min(step, totalSteps - 1));
	}

	/**
	 * Create a PositionResult from calculated values.
	 *
	 * @param step - The calculated step (fractional)
	 * @param totalSteps - Total steps in sequence
	 * @param isAtEnd - Whether playback has reached the end
	 * @param isLooping - Whether playback is currently looping
	 * @returns Complete position result
	 */
	private createPositionResult(
		step: number,
		totalSteps: number,
		isAtEnd: boolean,
		isLooping: boolean
	): PositionResult {
		// Extract integer beat and fractional progress
		const beat = Math.floor(step);
		const beatProgress = step - beat;

		return {
			step,
			beat: Math.max(0, Math.min(beat, totalSteps > 0 ? totalSteps - 1 : 0)),
			beatProgress,
			isAtEnd,
			isLooping
		};
	}
}
