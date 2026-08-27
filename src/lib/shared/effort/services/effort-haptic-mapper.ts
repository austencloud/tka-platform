/**
 * Converts effort easing curves into haptic vibration patterns.
 *
 * Two strategies based on effort character:
 *
 * 1. **Monotonic efforts** (Laban: glide, dab, press, punch):
 *    Sample the acceleration profile and convert to pulse-width-modulated
 *    vibrations. Merge adjacent pulses so sustained acceleration (punch)
 *    becomes one solid hit. Lower threshold allows gentle efforts (glide)
 *    to still register.
 *
 * 2. **Oscillating efforts** (elastic, bounce, anticipation):
 *    Find peaks and valleys in the curve value. Each direction reversal
 *    is a haptic event. The magnitude of the peak determines pulse width.
 *    This captures the bounce impacts, elastic wobble, and anticipation
 *    pullback directly from the curve shape rather than trying to derive
 *    them from acceleration (which gets overwhelmed by the initial rise).
 */

import type { EffortId, EffortParams } from "../domain/effort-types";
import { applyEffort } from "../domain/effort-easing-unified";

const DEFAULT_DURATION_MS = 400;
const SAMPLE_COUNT = 100;
const MIN_PULSE_MS = 8;
const MIN_PAUSE_MS = 8;
const MERGE_GAP_MS = 20;

const OSCILLATING_EFFORTS: ReadonlySet<EffortId> = new Set([
	"elastic",
	"bounce",
	"anticipation",
]);

export function generatePattern(
	effortId: EffortId,
	params?: EffortParams,
	durationMs: number = DEFAULT_DURATION_MS
): number[] {
	if (effortId === "linear") {
		return generateLinearPattern(durationMs);
	}

	if (OSCILLATING_EFFORTS.has(effortId)) {
		return generateFromPeaks(effortId, params, durationMs);
	}

	return generateFromAcceleration(effortId, params, durationMs);
}

export function getIOSPulseCount(effortId: EffortId, params?: EffortParams): number {
	switch (effortId) {
		case "linear":
			return 3;
		case "glide":
			return 2;
		case "dab":
			return 1;
		case "press":
			return 3;
		case "punch":
			return 1;
		case "elastic": {
			const freq = params?.frequency ?? 1.0;
			return Math.round(2 + freq);
		}
		case "bounce":
			return 3;
		case "anticipation":
			return 2;
		default:
			return 1;
	}
}

// Strategy 1: Acceleration-based (monotonic Laban efforts)

function generateFromAcceleration(
	effortId: EffortId,
	params: EffortParams | undefined,
	durationMs: number
): number[] {
	const samples = sampleCurve(effortId, params);
	const acceleration = computeAcceleration(samples);
	const windows = quantizeToWindows(acceleration, durationMs);
	const raw = windowsToVibratePattern(windows);
	return mergeAdjacentPulses(raw);
}

function sampleCurve(effortId: EffortId, params?: EffortParams): number[] {
	const values: number[] = [];
	for (let i = 0; i <= SAMPLE_COUNT; i++) {
		const t = i / SAMPLE_COUNT;
		values.push(applyEffort(effortId, t, params));
	}
	return values;
}

function computeAcceleration(samples: number[]): number[] {
	const velocity: number[] = [];
	for (let i = 0; i < samples.length - 1; i++) {
		velocity.push((samples[i + 1]! - samples[i]!) * SAMPLE_COUNT);
	}

	const accel: number[] = [];
	for (let i = 0; i < velocity.length - 1; i++) {
		accel.push(Math.abs((velocity[i + 1]! - velocity[i]!) * SAMPLE_COUNT));
	}

	return accel;
}

function quantizeToWindows(
	acceleration: number[],
	totalDurationMs: number
): { intensity: number; durationMs: number }[] {
	const windowCount = Math.max(12, Math.min(20, Math.round(totalDurationMs / 25)));
	const windowDuration = totalDurationMs / windowCount;
	const samplesPerWindow = Math.max(1, Math.floor(acceleration.length / windowCount));

	const windows: { intensity: number; durationMs: number }[] = [];

	let peakAccel = 0;
	for (const a of acceleration) {
		if (a > peakAccel) peakAccel = a;
	}
	if (peakAccel < 0.001) peakAccel = 1;

	for (let w = 0; w < windowCount; w++) {
		const startSample = w * samplesPerWindow;
		const endSample = Math.min(startSample + samplesPerWindow, acceleration.length);

		let maxAccel = 0;
		for (let s = startSample; s < endSample; s++) {
			const val = acceleration[s] ?? 0;
			if (val > maxAccel) maxAccel = val;
		}

		windows.push({ intensity: maxAccel / peakAccel, durationMs: windowDuration });
	}

	return windows;
}

function windowsToVibratePattern(
	windows: { intensity: number; durationMs: number }[]
): number[] {
	const pattern: number[] = [];
	let accumulatedPause = 0;
	const THRESHOLD = 0.05;

	for (const window of windows) {
		if (window.intensity < THRESHOLD) {
			accumulatedPause += window.durationMs;
			continue;
		}

		const vibrateDuration = Math.max(
			MIN_PULSE_MS,
			Math.round(window.durationMs * window.intensity * 0.85)
		);
		const pauseDuration = Math.max(
			MIN_PAUSE_MS,
			Math.round(window.durationMs - vibrateDuration)
		);

		if (pattern.length === 0 && accumulatedPause > 0) {
			pattern.push(0, accumulatedPause);
			accumulatedPause = 0;
		} else if (accumulatedPause > 0) {
			pattern[pattern.length - 1]! += accumulatedPause;
			accumulatedPause = 0;
		}

		pattern.push(vibrateDuration, pauseDuration);
	}

	if (pattern.length > 0 && pattern.length % 2 === 0) {
		pattern.pop();
	}

	return pattern.length === 0 ? [30] : pattern;
}

function mergeAdjacentPulses(pattern: number[]): number[] {
	if (pattern.length <= 1) return pattern;

	const merged: number[] = [];
	let i = 0;

	while (i < pattern.length) {
		let currentVibrate = pattern[i]!;
		i++;

		while (i < pattern.length - 1) {
			const pause = pattern[i]!;
			const nextVibrate = pattern[i + 1]!;

			if (pause <= MERGE_GAP_MS) {
				currentVibrate += pause + nextVibrate;
				i += 2;
			} else {
				break;
			}
		}

		merged.push(currentVibrate);

		if (i < pattern.length) {
			merged.push(pattern[i]!);
			i++;
		}
	}

	if (merged.length > 0 && merged.length % 2 === 0) {
		merged.pop();
	}

	return merged;
}

// Strategy 2: Peak-based (oscillating efforts)

/**
 * Find peaks and valleys in the curve and create a haptic pulse
 * at each one. This captures bounce impacts, elastic wobble,
 * and anticipation pullback directly from the curve shape.
 *
 * The initial rise from 0 to ~1 always produces the first
 * (strongest) pulse. Subsequent oscillations produce smaller
 * pulses proportional to their amplitude.
 */
function generateFromPeaks(
	effortId: EffortId,
	params: EffortParams | undefined,
	durationMs: number
): number[] {
	const samples = sampleCurve(effortId, params);
	const events = findCurveEvents(samples);

	if (events.length === 0) {
		return [30];
	}

	return eventsToPattern(events, durationMs);
}

/**
 * A curve event is a moment where something interesting happens:
 * - The curve reaches its target (first crossing of 1.0)
 * - A peak (local maximum) - overshoot, bounce apex
 * - A valley (local minimum) - bounce impact, pullback bottom
 */
function findCurveEvents(
	samples: number[]
): { t: number; magnitude: number }[] {
	const events: { t: number; magnitude: number }[] = [];

	// Find the first time the curve reaches or exceeds ~0.9
	// This is the "main hit" - always the strongest event
	let mainHitIndex = -1;
	for (let i = 0; i < samples.length; i++) {
		if (samples[i]! >= 0.9) {
			mainHitIndex = i;
			break;
		}
	}

	if (mainHitIndex >= 0) {
		events.push({
			t: mainHitIndex / SAMPLE_COUNT,
			magnitude: 1.0,
		});
	}

	// Find peaks and valleys after the main hit
	const searchStart = Math.max(1, mainHitIndex + 1);
	for (let i = searchStart; i < samples.length - 1; i++) {
		const prev = samples[i - 1]!;
		const curr = samples[i]!;
		const next = samples[i + 1]!;

		const isPeak = curr > prev && curr > next;
		const isValley = curr < prev && curr < next;

		if (isPeak || isValley) {
			// Magnitude = how far from the target value (1.0)
			const deviation = Math.abs(curr - 1.0);

			// Only include if the deviation is noticeable
			if (deviation > 0.005) {
				events.push({
					t: i / SAMPLE_COUNT,
					magnitude: Math.min(1.0, deviation * 10),
				});
			}
		}
	}

	// Also check for values below zero (anticipation pullback)
	for (let i = 1; i < samples.length - 1; i++) {
		if (samples[i]! < -0.01) {
			const prev = samples[i - 1]!;
			const curr = samples[i]!;
			const next = samples[i + 1]!;

			// Find the valley of the pullback
			if (curr <= prev && curr <= next) {
				events.push({
					t: i / SAMPLE_COUNT,
					magnitude: Math.min(1.0, Math.abs(curr) * 5),
				});
			}
		}
	}

	// Sort by time
	events.sort((a, b) => a.t - b.t);

	// Deduplicate events that are very close in time
	const deduped: { t: number; magnitude: number }[] = [];
	for (const event of events) {
		const last = deduped[deduped.length - 1];
		if (!last || event.t - last.t > 0.05) {
			deduped.push(event);
		} else if (event.magnitude > last.magnitude) {
			// Keep the stronger event
			deduped[deduped.length - 1] = event;
		}
	}

	return deduped;
}

/**
 * Convert curve events into a Vibration API pattern.
 * Each event becomes a vibrate pulse. The gap between events
 * becomes pause duration. Pulse width is proportional to
 * the event's magnitude.
 */
function eventsToPattern(
	events: { t: number; magnitude: number }[],
	durationMs: number
): number[] {
	const pattern: number[] = [];

	// Max pulse width: 80ms for the strongest event
	const maxPulseMs = 80;
	const minPulseMs = 12;

	for (let i = 0; i < events.length; i++) {
		const event = events[i]!;

		// Leading pause before first event
		if (i === 0 && event.t > 0.05) {
			const leadPause = Math.round(event.t * durationMs);
			pattern.push(0, leadPause);
		}

		// Pulse width proportional to magnitude
		const pulseMs = Math.max(
			minPulseMs,
			Math.round(maxPulseMs * event.magnitude)
		);
		pattern.push(pulseMs);

		// Pause until next event (or end)
		if (i < events.length - 1) {
			const nextEvent = events[i + 1]!;
			const gapMs = Math.max(
				MIN_PAUSE_MS,
				Math.round((nextEvent.t - event.t) * durationMs - pulseMs)
			);
			pattern.push(gapMs);
		}
	}

	// Remove trailing pause
	if (pattern.length > 0 && pattern.length % 2 === 0) {
		pattern.pop();
	}

	return pattern.length === 0 ? [30] : pattern;
}

// Special case: linear

function generateLinearPattern(durationMs: number): number[] {
	const pulseCount = 4;
	const pulseMs = 25;
	const gapMs = Math.round((durationMs - pulseCount * pulseMs) / (pulseCount - 1));
	const pattern: number[] = [];

	for (let i = 0; i < pulseCount; i++) {
		pattern.push(pulseMs);
		if (i < pulseCount - 1) {
			pattern.push(gapMs);
		}
	}

	return pattern;
}
