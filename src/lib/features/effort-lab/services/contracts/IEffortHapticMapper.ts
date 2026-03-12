/**
 * Maps effort easing curves to haptic vibration patterns.
 *
 * Each effort's mathematical curve gets sampled and converted into a
 * Vibration API pattern (alternating vibrate/pause durations in ms).
 * The result captures the "feel" of the effort: bounce produces
 * decreasing-intensity impacts, elastic produces overshoot wobble,
 * anticipation produces a pullback stutter then release, etc.
 */

import type { EffortId, EffortParams } from "../../domain/effort-types";

export interface IEffortHapticMapper {
	/**
	 * Generate a Vibration API pattern from an effort's easing curve.
	 * Returns alternating [vibrate, pause, vibrate, pause, ...] in ms.
	 *
	 * @param effortId - Which effort to generate a pattern for
	 * @param params - Optional effort parameters (e.g., bounce count, pullback amount)
	 * @param durationMs - Total pattern duration in ms (default: 400)
	 */
	generatePattern(
		effortId: EffortId,
		params?: EffortParams,
		durationMs?: number
	): number[];

	/**
	 * Get the iOS pulse count approximation for an effort.
	 * iOS can't do variable-duration vibrations, so we approximate
	 * with a pulse count that captures the effort's character.
	 */
	getIOSPulseCount(effortId: EffortId, params?: EffortParams): number;
}
