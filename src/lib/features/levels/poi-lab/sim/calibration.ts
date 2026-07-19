/**
 * Calibration — maps TKA/mandala grid-unit space to physical reality (meters,
 * seconds) so the poi momentum sim can drive a real Verlet solver from
 * sampled hand paths.
 *
 * Three numbers do all the work: tether length (meters), hand-path radius in
 * meters (mandala grid units → meters), and BPM → beat duration.
 */

import { MANDALA_GRID_RADIUS } from "$lib/shared/mandala/domain/mandala-constants";

/** Grid-unit radius the mandala geometry calculator samples in. */
export { MANDALA_GRID_RADIUS };

/** Default tether (cord) length in meters. */
export const DEFAULT_TETHER_LENGTH_METERS = 0.75;

/** Physically sane tether-length range for the UI slider. */
export const TETHER_LENGTH_RANGE_METERS = { min: 0.5, max: 0.9 } as const;

/** Physically sane tempo range for the UI slider and min-BPM bisection. */
export const BPM_RANGE = { min: 40, max: 240 } as const;

/**
 * Default hand-path radius in meters — how far the hand travels from the
 * body's center at grid radius 1.0 (i.e. `MANDALA_GRID_RADIUS` grid units).
 * A comfortable poi hand-circle radius for an extended arm.
 */
export const DEFAULT_HAND_RADIUS_METERS = 0.6;

export interface CalibrationOptions {
	/** Real-world radius (meters) that `MANDALA_GRID_RADIUS` grid units maps to. */
	handRadiusMeters?: number;
}

/**
 * Converts a value expressed in mandala grid units into meters, using the
 * calibrated hand-path radius as the scale reference: `MANDALA_GRID_RADIUS`
 * grid units == `handRadiusMeters` meters.
 */
export function gridToMeters(
	gridUnits: number,
	options: CalibrationOptions = {}
): number {
	const handRadiusMeters = clamp(
		options.handRadiusMeters ?? DEFAULT_HAND_RADIUS_METERS,
		1e-6,
		Number.POSITIVE_INFINITY
	);
	return (gridUnits / MANDALA_GRID_RADIUS) * handRadiusMeters;
}

/**
 * Inverse of `gridToMeters` — converts a physical length (meters) into
 * mandala grid units, using the same calibrated hand-path radius as the
 * scale reference. Used to derive the intended-head tip offset from the
 * (adjustable) tether length, instead of a fixed grid-unit constant.
 */
export function metersToGrid(
	meters: number,
	options: CalibrationOptions = {}
): number {
	const handRadiusMeters = clamp(
		options.handRadiusMeters ?? DEFAULT_HAND_RADIUS_METERS,
		1e-6,
		Number.POSITIVE_INFINITY
	);
	return (meters / handRadiusMeters) * MANDALA_GRID_RADIUS;
}

/**
 * Converts a BPM value into the duration of one beat, in seconds. Clamps the
 * input to `BPM_RANGE` first — sliders and bisection callers should never
 * hand this a value outside the physically meaningful range.
 */
export function beatDuration(bpm: number): number {
	const clampedBpm = clamp(bpm, BPM_RANGE.min, BPM_RANGE.max);
	return 60 / clampedBpm;
}

/** Clamps a tether length (meters) into the UI's supported range. */
export function clampTetherLength(lengthMeters: number): number {
	return clamp(
		lengthMeters,
		TETHER_LENGTH_RANGE_METERS.min,
		TETHER_LENGTH_RANGE_METERS.max
	);
}

/** Clamps a BPM value into the supported range. */
export function clampBpm(bpm: number): number {
	return clamp(bpm, BPM_RANGE.min, BPM_RANGE.max);
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}
