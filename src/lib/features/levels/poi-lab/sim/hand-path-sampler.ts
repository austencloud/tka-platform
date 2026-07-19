/**
 * Hand-path sampler — wraps the mandala geometry calculator to produce the
 * two paths the poi momentum sim needs for one color: the hand-center path
 * (kinematic driver for the sim's "hand" particle) and the intended head
 * path (what a perfectly taut cord would trace, used as the physics ground
 * truth to compare the simulated head against).
 *
 * Both paths are sampled uniformly in time (`computeUniformHandPath`, not
 * `calculate`) so every beat contributes the same sample count — required by
 * the fixed-timestep Verlet sim downstream.
 */

import { computeUniformHandPath } from "$lib/shared/mandala/services/mandala-geometry-calculator";
import { BASE_SAMPLES_PER_BEAT } from "$lib/shared/mandala/domain/mandala-constants";
import type { StepLike } from "$lib/shared/mandala/services/types";
import type { MandalaPoint } from "$lib/shared/mandala/domain/mandala-types";

export type PoiHandColor = "blue" | "red";

export interface HandPathSample {
	/** Hand-center path, in mandala grid units, sampled uniformly in time. */
	hand: MandalaPoint[];
	/**
	 * Intended head path — where the propelled tip should be if the cord
	 * stays taut at `tetherTipDx`, in mandala grid units.
	 */
	intendedHead: MandalaPoint[];
	/** Uniform sample count used per beat (both paths share it). */
	samplesPerBeat: number;
}

export interface HandPathSamplerOptions {
	/** Samples per beat. Defaults to the mandala calculator's base rate. */
	samplesPerBeat?: number;
}

/**
 * Samples the hand-center path and the intended-head path for one color
 * across the given steps.
 *
 * @param steps sequence steps with motion data (see `StepLike`)
 * @param color which hand ("blue" | "red") to sample
 * @param tetherTipDx tip offset (grid units, same space as
 *   `MANDALA_STANDARD_TIP_DX`) representing the propelled head at full
 *   tether extension. `0` collapses the tip to the hand itself.
 *
 * @throws if `steps` contains no visible motion for either hand — sampling
 *   an empty sequence is a caller bug, not a runtime condition to recover
 *   from (see `no-fabrication`/error-handling: earned, not defensive).
 */
export function sampleHandPath(
	steps: readonly StepLike[],
	color: PoiHandColor,
	tetherTipDx: number,
	options: HandPathSamplerOptions = {}
): HandPathSample {
	const samplesPerBeat = options.samplesPerBeat ?? BASE_SAMPLES_PER_BEAT;

	const hand = computeUniformHandPath(
		steps,
		color,
		{ dx: 0, dy: 0 },
		samplesPerBeat
	);
	const intendedHead = computeUniformHandPath(
		steps,
		color,
		{ dx: tetherTipDx, dy: 0 },
		samplesPerBeat
	);

	if (hand.length === 0 || intendedHead.length === 0) {
		throw new Error(
			`sampleHandPath: no visible motion for "${color}" hand across the given steps`
		);
	}

	return { hand, intendedHead, samplesPerBeat };
}
