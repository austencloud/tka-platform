/**
 * Unified easing functions for all 8 effort qualities.
 *
 * 1 baseline (linear) is the identity function.
 * 4 Laban efforts (glide, dab, press, punch) delegate to applyLabanEasing.
 * 3 animation efforts (elastic, bounce, anticipation) are standalone.
 *
 * Every function guarantees f(0)=0 and f(1)=1.
 */

import type { EffortId, EffortParams } from "./effort-types";
import { EFFORTS } from "./effort-types";
import { applyLabanEasing } from "./laban-easing";

export interface EasingSample {
	t: number;
	value: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDefault(effortId: EffortId, key: string): number {
	const effort = EFFORTS.find((e) => e.id === effortId);
	const param = effort?.params.find((p) => p.key === key);
	return param?.defaultValue ?? 0;
}

function resolve(
	effortId: EffortId,
	key: string,
	params?: EffortParams
): number {
	return params?.[key] ?? getDefault(effortId, key);
}

// ---------------------------------------------------------------------------
// Baseline
// ---------------------------------------------------------------------------

function linear(t: number): number {
	if (t <= 0) return 0;
	if (t >= 1) return 1;
	return t;
}

// ---------------------------------------------------------------------------
// Laban efforts — delegate to applyLabanEasing
// ---------------------------------------------------------------------------

function glide(t: number, params?: EffortParams): number {
	return applyLabanEasing(
		t,
		resolve("glide", "weight", params),
		resolve("glide", "time", params)
	);
}

function dab(t: number, params?: EffortParams): number {
	return applyLabanEasing(
		t,
		resolve("dab", "weight", params),
		resolve("dab", "time", params)
	);
}

function press(t: number, params?: EffortParams): number {
	return applyLabanEasing(
		t,
		resolve("press", "weight", params),
		resolve("press", "time", params)
	);
}

function punch(t: number, params?: EffortParams): number {
	return applyLabanEasing(
		t,
		resolve("punch", "weight", params),
		resolve("punch", "time", params)
	);
}

// ---------------------------------------------------------------------------
// Animation efforts
// ---------------------------------------------------------------------------

/**
 * Elastic ease-out: overshoots 1.0 then oscillates back with exponential decay.
 */
function elastic(t: number, params?: EffortParams): number {
	if (t <= 0) return 0;
	if (t >= 1) return 1;

	const amplitude = resolve("elastic", "amplitude", params);
	const frequency = resolve("elastic", "frequency", params);

	// Elastic ease-out: decaying sinusoidal oscillation around 1.0
	const decay = Math.pow(2, -10 * t);
	return 1 - decay * Math.cos(t * frequency * Math.PI * 2) * amplitude + decay * (amplitude - 1);
}

/**
 * Bounce ease-out: parabolic arcs of diminishing height.
 * Uses the classic bounce algorithm scaled by bounce count.
 */
function bounce(t: number, params?: EffortParams): number {
	if (t <= 0) return 0;
	if (t >= 1) return 1;

	const bounces = resolve("bounce", "bounces", params);

	// Standard bounce easing adapted for variable bounce count.
	// The multiplier controls how quickly bounces decay.
	const n1 = 7.5625;
	const d1 = 2.75;

	// Scale the number of bounces relative to 3 (the standard).
	// More bounces = compress the time domain.
	const scale = bounces / 3;
	const ts = t; // Already in [0,1]

	// Use standard bounce-out algorithm
	let result: number;
	if (ts < 1 / d1) {
		result = n1 * ts * ts;
	} else if (ts < 2 / d1) {
		const adj = ts - 1.5 / d1;
		result = n1 * adj * adj + 0.75;
	} else if (ts < 2.5 / d1) {
		const adj = ts - 2.25 / d1;
		result = n1 * adj * adj + 0.9375;
	} else {
		const adj = ts - 2.625 / d1;
		result = n1 * adj * adj + 0.984375;
	}

	// For non-default bounce counts, blend with a power curve
	// to keep the overall shape while adjusting intensity.
	if (Math.abs(scale - 1) > 0.01) {
		const power = 1 / scale;
		const simple = Math.pow(t, power);
		result = result * 0.7 + simple * 0.3;
	}

	return Math.min(result, 1);
}

/**
 * Anticipation: back ease-in-out. Pulls backward (below 0) before
 * accelerating forward, with slight overshoot at end.
 */
function anticipation(t: number, params?: EffortParams): number {
	if (t <= 0) return 0;
	if (t >= 1) return 1;

	const pullback = resolve("anticipation", "pullback", params);

	// Back ease-in-out with configurable overshoot
	const s = pullback * 7.5; // Scale pullback to a back-easing overshoot constant

	if (t < 0.5) {
		const t2 = 2 * t;
		return 0.5 * (t2 * t2 * ((s + 1) * t2 - s));
	} else {
		const t2 = 2 * t - 2;
		return 0.5 * (t2 * t2 * ((s + 1) * t2 + s) + 2);
	}
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

const EFFORT_FNS: Record<
	EffortId,
	(t: number, params?: EffortParams) => number
> = {
	linear,
	glide,
	dab,
	press,
	punch,
	elastic,
	bounce,
	anticipation,
};

/**
 * Single entry point: apply the easing function for a given effort quality.
 */
export function applyEffort(
	id: EffortId,
	t: number,
	params?: EffortParams
): number {
	return EFFORT_FNS[id](t, params);
}

/**
 * Sample an effort curve at evenly-spaced intervals.
 * Returns `samples + 1` entries (including t=0 and t=1).
 */
export function sampleEffortCurve(
	id: EffortId,
	samples: number,
	params?: EffortParams
): EasingSample[] {
	const result: EasingSample[] = [];
	for (let i = 0; i <= samples; i++) {
		const t = i / samples;
		result.push({ t, value: applyEffort(id, t, params) });
	}
	return result;
}
