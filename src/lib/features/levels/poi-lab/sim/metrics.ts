/**
 * Sim metrics — post-processes a `PoiSimFrame[]` run into the two
 * performability signals the physical layer reports: slack fraction and
 * head deviation from the intended (perfectly-taut) TKA head path.
 */

import type { PoiSimFrame, RunSimulationOptions, Vec2 } from "$lib/features/levels/poi-lab/sim/poi-sim";
import { BPM_RANGE, clampBpm } from "$lib/features/levels/poi-lab/sim/calibration";

export interface PerformabilityThresholds {
	/** Max acceptable slack fraction (0-1). Default 0.05 (5%). */
	maxSlackFraction?: number;
	/** Max acceptable mean deviation from the intended head path, in meters. Default 0.15. */
	maxDeviationMeters?: number;
}

const DEFAULT_MAX_SLACK_FRACTION = 0.05;
const DEFAULT_MAX_DEVIATION_METERS = 0.15;

/** Fraction of frames where the tether is not taut (cord has gone slack). */
export function slackFraction(frames: readonly PoiSimFrame[]): number {
	if (frames.length === 0) return 0;
	const slackCount = frames.reduce((count, f) => count + (f.taut ? 0 : 1), 0);
	return slackCount / frames.length;
}

/**
 * Mean and max distance (meters) between the simulated head and the intended
 * TKA head path at matching sim-time, in meters. `intendedHeadAt` must return
 * the intended head position for a given simulation time `t` (seconds); the
 * caller resamples the intended path (already computed via
 * `hand-path-sampler.ts` + calibration) to align with the frame's own `t`.
 */
export function headDeviation(
	frames: readonly PoiSimFrame[],
	intendedHeadAt: (t: number) => Vec2
): { mean: number; max: number } {
	if (frames.length === 0) return { mean: 0, max: 0 };

	let sum = 0;
	let max = 0;
	for (const frame of frames) {
		const intended = intendedHeadAt(frame.t);
		const dist = Math.hypot(frame.head.x - intended.x, frame.head.y - intended.y);
		sum += dist;
		if (dist > max) max = dist;
	}

	return { mean: sum / frames.length, max };
}

export interface PerformabilityResult {
	slackFraction: number;
	meanDeviationMeters: number;
	maxDeviationMeters: number;
	performable: boolean;
}

/** Evaluates a run against the performability thresholds. */
export function evaluatePerformability(
	frames: readonly PoiSimFrame[],
	intendedHeadAt: (t: number) => Vec2,
	thresholds: PerformabilityThresholds = {}
): PerformabilityResult {
	const maxSlack = thresholds.maxSlackFraction ?? DEFAULT_MAX_SLACK_FRACTION;
	const maxDeviation = thresholds.maxDeviationMeters ?? DEFAULT_MAX_DEVIATION_METERS;

	const slack = slackFraction(frames);
	const deviation = headDeviation(frames, intendedHeadAt);
	const performable = slack <= maxSlack && deviation.mean <= maxDeviation;

	return {
		slackFraction: slack,
		meanDeviationMeters: deviation.mean,
		maxDeviationMeters: deviation.max,
		performable,
	};
}

export interface FindMinBpmOptions {
	/** Runs the sim at the given BPM and returns whether the result is performable. */
	runAtBpm: (bpm: number) => boolean;
	/** BPM search range. Defaults to `BPM_RANGE` (40-240). */
	range?: { min: number; max: number };
	/** Bisection tolerance, in BPM. Default 1. */
	toleranceBpm?: number;
}

/**
 * Bisects `range` (default 40-240 BPM) to find the minimum BPM at which
 * `runAtBpm` reports the run as performable. Assumes monotonicity — higher
 * BPM (faster hand, more momentum) is performable once any BPM in range is,
 * which is the sim's physical premise (more speed keeps the cord taut).
 *
 * Returns `range.max` if even the fastest tempo tested isn't performable
 * (no floor found in range), or `range.min` if the slowest tempo already is.
 */
export function findMinBpm(options: FindMinBpmOptions): number {
	const range = options.range ?? BPM_RANGE;
	const tolerance = options.toleranceBpm ?? 1;
	const min = clampBpm(range.min);
	const max = clampBpm(range.max);

	if (options.runAtBpm(min)) return min;
	if (!options.runAtBpm(max)) return max;

	let lo = min;
	let hi = max;
	while (hi - lo > tolerance) {
		const mid = (lo + hi) / 2;
		if (options.runAtBpm(mid)) {
			hi = mid;
		} else {
			lo = mid;
		}
	}

	return hi;
}

export type { RunSimulationOptions };
