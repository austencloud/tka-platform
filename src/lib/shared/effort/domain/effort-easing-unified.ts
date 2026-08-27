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

// Helpers

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

// Baseline

function linear(t: number): number {
	if (t <= 0) return 0;
	if (t >= 1) return 1;
	return t;
}

// Laban efforts - delegate to applyLabanEasing

function glide(t: number, params?: EffortParams): number {
	return applyLabanEasing(
		t,
		resolve("glide", "weight", params),
		resolve("glide", "time", params)
	);
}

function dab(t: number, params?: EffortParams): number {
	return frontLoadedLabanEasing(
		t,
		resolve("dab", "weight", params),
		resolve("dab", "time", params)
	);
}

/**
 * Press and punch are "heavy" efforts (high weight) whose raw Laban curves
 * are back-loaded - the motion crammed into the last 20-30% of the beat.
 * When practicing, you say "eight" at the start of the beat and expect to
 * see position 8. But with back-loaded curves, the props are still at
 * position 7 until the beat is almost over.
 *
 * The fix: flip the curve so the snap happens at the START of the beat.
 * f(t) = 1 - laban(1-t) reflects the back-loaded curve into a front-loaded
 * one. The props arrive immediately, then hold for the rest of the beat.
 * Glide and dab are unaffected (they're light efforts, already intuitive).
 */
function frontLoadedLabanEasing(
	t: number,
	weight: number,
	time: number
): number {
	if (t <= 0) return 0;
	if (t >= 1) return 1;
	return 1 - applyLabanEasing(1 - t, weight, time);
}

function press(t: number, params?: EffortParams): number {
	return frontLoadedLabanEasing(
		t,
		resolve("press", "weight", params),
		resolve("press", "time", params)
	);
}

function punch(t: number, params?: EffortParams): number {
	return frontLoadedLabanEasing(
		t,
		resolve("punch", "weight", params),
		resolve("punch", "time", params)
	);
}

// Animation efforts

/**
 * Elastic ease-out: overshoot then settle.
 * Models a staff swinging past its target and settling back.
 *
 * Uses a physically-based damped spring instead of the standard elastic-out
 * formula (easings.net). The standard formula is `1 + oscillation * decay`
 * which starts at ~1.0 on frame 1 and just wobbles - the approach to the
 * target is invisible. A damped spring starts at 0, ramps up toward 1 with
 * visible acceleration, overshoots past 1 around t=0.4-0.5, then settles.
 * The eye can track the entire motion.
 *
 * amplitude (default 0.4) controls overshoot magnitude (~9% at default).
 * frequency (default 1.0) controls oscillation count (higher = more wobble).
 */
function elastic(t: number, params?: EffortParams): number {
	if (t <= 0) return 0;
	if (t >= 1) return 1;

	const amplitude = resolve("elastic", "amplitude", params);
	const frequency = resolve("elastic", "frequency", params);

	// Damped spring: x(t) = 1 - e^(-ζωt) * [cos(ωd·t) + (ζω/ωd)·sin(ωd·t)]
	// The amplitude slider maps inversely to damping ratio (ζ):
	// amp=0.1 → zeta=0.71 (heavy damping, subtle ~4% overshoot)
	// amp=0.4 → zeta=0.61 (moderate, one clear ~9% overshoot peaking at t≈0.4)
	// amp=0.8 → zeta=0.47 (springy, ~19% overshoot)
	// amp=1.5 → zeta=0.23 (very springy, ~48% overshoot with multiple oscillations)
	const zeta = Math.max(0.1, 0.75 - amplitude * 0.35);
	const omega = 10 * frequency; // Natural frequency
	const omegaD = omega * Math.sqrt(Math.max(1 - zeta * zeta, 0.001));

	const decay = Math.exp(-zeta * omega * t);
	const cosine = Math.cos(omegaD * t);
	const sine = Math.sin(omegaD * t);

	// Full damped spring response from rest (position 0 → target 1).
	// Includes both cosine and sine terms for correct initial velocity.
	return 1 - decay * (cosine + ((zeta * omega) / omegaD) * sine);
}

/**
 * Bounce ease-out: the classic CSS bounce algorithm.
 * Four parabolic arcs of decreasing height, like a ball settling.
 * No parameters - the standard curve already feels right.
 */
function bounce(t: number, _params?: EffortParams): number {
	if (t <= 0) return 0;
	if (t >= 1) return 1;

	const n1 = 7.5625;
	const d1 = 2.75;

	if (t < 1 / d1) {
		return n1 * t * t;
	} else if (t < 2 / d1) {
		const adj = t - 1.5 / d1;
		return n1 * adj * adj + 0.75;
	} else if (t < 2.5 / d1) {
		const adj = t - 2.25 / d1;
		return n1 * adj * adj + 0.9375;
	} else {
		const adj = t - 2.625 / d1;
		return n1 * adj * adj + 0.984375;
	}
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

// Dispatch

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
