/**
 * MandalaGeometryCalculator
 *
 * Computes prop tip paths for LOOP sequences by replicating the animation
 * engine's interpolation math headlessly. Given a sequence of steps, it
 * produces SVG path data for each hand's left and right staff tips.
 *
 * Ported from the validated prototype at scripts/mandala-prototype.cjs.
 * All junction gaps are 0px when staff angles are chained across beats.
 */

import {
	normalizeAnglePositive,
	normalizeAngleSigned,
	mapOrientationToAngle,
} from "$lib/shared/animation-engine/services/angle-calculator";
import {
	LOCATION_ANGLES,
	PI,
} from "$lib/shared/foundation/domain/math-constants";
import { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { isVisibleMotion } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import { RADIAL_CYCLE } from "$lib/shared/render/core/calculations/orientation-angle";
import { handArcDirection } from "@tka/sequence-engine/analysis";
import {
	BASE_SAMPLES_PER_BEAT,
	MANDALA_GRID_RADIUS,
	MANDALA_STANDARD_TIP_DX,
	ENGINE_GRID_RADIUS,
} from "../domain/mandala-constants";
import type {
	MandalaPaths,
	SVGPathData,
	MandalaPoint,
} from "../domain/mandala-types";
import type {
	StepLike,
	MotionLike,
	MandalaPathOptions,
	MandalaTipOffset,
	MandalaTipOverrides,
} from "./types";


type TipOffset = MandalaTipOffset;

interface MotionEndpoints {
	startCenterAngle: number;
	targetCenterAngle: number;
	centerRotationDelta: number;
	startStaffAngle: number;
	staffRotationDelta: number;
	motionType: string;
}

interface InterpolatedPosition {
	x: number;
	y: number;
	staffAngle: number;
}


// The LOCATION_ANGLES map from math-constants uses GridLocation enum keys.
// Firestore data uses lowercase strings ("n", "e", "s", etc.).
// Build a string-keyed lookup so we can resolve either form.

const LOCATION_ANGLE_LOOKUP: Record<string, number> = {};

for (const [key, value] of Object.entries(LOCATION_ANGLES)) {
	LOCATION_ANGLE_LOOKUP[key] = value;
}

// Also add common lowercase aliases that Firestore data uses
const LOWERCASE_ALIASES: Record<string, string> = {
	center: "c",
};

function resolveLocationAngle(loc: string): number {
	// Try direct lookup first (handles enum values like "n", "e", etc.)
	if (loc in LOCATION_ANGLE_LOOKUP) {
		return LOCATION_ANGLE_LOOKUP[loc] ?? 0;
	}
	// Try alias
	const alias = LOWERCASE_ALIASES[loc];
	if (alias && alias in LOCATION_ANGLE_LOOKUP) {
		return LOCATION_ANGLE_LOOKUP[alias] ?? 0;
	}
	return 0;
}


// The existing mapOrientationToAngle expects Orientation values. Firestore
// stores those values as strings, including the four interradial orientations.

function resolveOrientationAngle(
	ori: string | undefined,
	centerAngle: number
): number {
	const enumValue = (RADIAL_CYCLE as readonly string[]).includes(ori ?? "")
		? (ori as Orientation)
		: Orientation.OUT;
	return mapOrientationToAngle(enumValue, centerAngle);
}


function parseDirection(rotDir: string): number {
	if (rotDir === "ccw" || rotDir === "counter_clockwise") return -1;
	// "cw", "clockwise", "noRotation", or anything else
	return 1;
}

function isNoRotation(rotDir: string): boolean {
	return rotDir === "noRotation" || rotDir === "no_rotation";
}

function resolveCenterRotationDelta(
	motion: {
		startLoc: string;
		endLoc: string;
		handPath?: string | null;
	},
	startCenterAngle: number,
	targetCenterAngle: number
): number {
	const direction = handArcDirection({
		startLocation: motion.startLoc,
		endLocation: motion.endLoc,
		handPath: motion.handPath,
	});

	if (direction === "cw") {
		return normalizeAnglePositive(targetCenterAngle - startCenterAngle);
	}
	if (direction === "ccw") {
		return -normalizeAnglePositive(startCenterAngle - targetCenterAngle);
	}

	return normalizeAngleSigned(targetCenterAngle - startCenterAngle);
}


// Replicates EndpointCalculator.ts logic per motion type.
// PRO: staffDelta = centerMovement + (dir * turns * PI)
// ANTI: staffDelta = -centerMovement + (dir * turns * PI)
// STATIC with turns: staffDelta = dir * turns * PI
// STATIC no turns: staffDelta = shortest path to target staff angle
// DASH with turns: staffDelta = dir * turns * PI
// DASH no turns: staffDelta = shortest path to target staff angle
// FLOAT: staffDelta = 0

function calculateMotionEndpoints(motion: {
	motionType: string;
	rotDir: string;
	startLoc: string;
	endLoc: string;
	startOrientation: string;
	endOrientation: string;
	turns: number;
	handPath?: string | null;
}): MotionEndpoints {
	const startCenterAngle = resolveLocationAngle(motion.startLoc);
	const targetCenterAngle = resolveLocationAngle(motion.endLoc);
	const centerRotationDelta = resolveCenterRotationDelta(
		motion,
		startCenterAngle,
		targetCenterAngle
	);

	const startStaffAngle = resolveOrientationAngle(
		motion.startOrientation,
		startCenterAngle
	);
	const targetStaffAngleFromOri = resolveOrientationAngle(
		motion.endOrientation,
		targetCenterAngle
	);

	const turns = motion.turns;
	const dir = parseDirection(motion.rotDir);

	let staffRotationDelta: number;

	switch (motion.motionType) {
		case "pro": {
			const propRotation = dir * turns * PI;
			staffRotationDelta = centerRotationDelta + propRotation;
			break;
		}
		case "anti": {
			const propRotation = dir * turns * PI;
			staffRotationDelta = -centerRotationDelta + propRotation;
			break;
		}
		case "static": {
			if (turns > 0 && !isNoRotation(motion.rotDir)) {
				staffRotationDelta = dir * turns * PI;
			} else {
				staffRotationDelta = normalizeAngleSigned(
					targetStaffAngleFromOri - startStaffAngle
				);
			}
			break;
		}
		case "dash": {
			if (turns > 0) {
				staffRotationDelta = dir * turns * PI;
			} else {
				staffRotationDelta = normalizeAngleSigned(
					targetStaffAngleFromOri - startStaffAngle
				);
			}
			break;
		}
		case "float": {
			staffRotationDelta = 0;
			break;
		}
		default:
			staffRotationDelta = 0;
	}

	return {
		startCenterAngle,
		targetCenterAngle,
		centerRotationDelta,
		startStaffAngle,
		staffRotationDelta,
		motionType: motion.motionType,
	};
}


type PathShape = "arc" | "linear" | "concave";

function resolvePathShape(
	motionType: string,
	motionPathShape: PathShape | undefined,
	options: MandalaPathOptions | undefined
): PathShape {
	if (motionPathShape) return motionPathShape;
	if (options?.motionAware) {
		if (motionType === "pro") return "arc";
		if (motionType === "anti") return "concave";
		return "arc";
	}
	return options?.pathShape ?? "arc";
}


function interpolateLinear(
	startAngle: number,
	endAngle: number,
	t: number,
	staffAngle: number
): InterpolatedPosition {
	const startX = Math.cos(startAngle);
	const startY = Math.sin(startAngle);
	const endX = Math.cos(endAngle);
	const endY = Math.sin(endAngle);
	const x = startX + (endX - startX) * t;
	const y = startY + (endY - startY) * t;
	return { x, y, staffAngle };
}

function interpolateConcave(
	startAngle: number,
	endAngle: number,
	centerRotationDelta: number,
	t: number,
	staffAngle: number
): InterpolatedPosition {
	const arcAngle = normalizeAnglePositive(
		startAngle + centerRotationDelta * t
	);
	const circleX = Math.cos(arcAngle);
	const circleY = Math.sin(arcAngle);

	const startX = Math.cos(startAngle);
	const startY = Math.sin(startAngle);
	const endX = Math.cos(endAngle);
	const endY = Math.sin(endAngle);
	const straightX = startX + (endX - startX) * t;
	const straightY = startY + (endY - startY) * t;

	const x = 2 * straightX - circleX;
	const y = 2 * straightY - circleY;
	return { x, y, staffAngle };
}

function interpolate(
	endpoints: MotionEndpoints,
	t: number,
	pathShape: PathShape = "arc"
): InterpolatedPosition {
	const {
		startCenterAngle,
		targetCenterAngle,
		centerRotationDelta,
		startStaffAngle,
		staffRotationDelta,
		motionType,
	} = endpoints;

	const staffAngle = normalizeAnglePositive(
		startStaffAngle + staffRotationDelta * t
	);

	if (motionType === "dash") {
		return interpolateLinear(startCenterAngle, targetCenterAngle, t, staffAngle);
	}

	if (motionType === "static") {
		const x = Math.cos(startCenterAngle);
		const y = Math.sin(startCenterAngle);
		return { x, y, staffAngle };
	}

	switch (pathShape) {
		case "linear":
			return interpolateLinear(startCenterAngle, targetCenterAngle, t, staffAngle);
		case "concave":
			return interpolateConcave(
				startCenterAngle,
				targetCenterAngle,
				centerRotationDelta,
				t,
				staffAngle
			);
		case "arc":
		default: {
			const centerAngle = normalizeAnglePositive(
				startCenterAngle + centerRotationDelta * t
			);
			const x = Math.cos(centerAngle);
			const y = Math.sin(centerAngle);
			return { x, y, staffAngle };
		}
	}
}


function computeTipPosition(
	handPos: InterpolatedPosition,
	tipOffset: TipOffset,
	gridRadius: number
): MandalaPoint {
	const handX = handPos.x * gridRadius;
	const handY = handPos.y * gridRadius;

	// Scale tip offsets from engine coordinate space to mandala coordinate space
	const tipScale = gridRadius / ENGINE_GRID_RADIUS;
	const dx = tipOffset.dx * tipScale;
	const dy = tipOffset.dy * tipScale;

	const cosA = Math.cos(handPos.staffAngle);
	const sinA = Math.sin(handPos.staffAngle);

	const tipX = handX + (dx * cosA - dy * sinA);
	const tipY = handY + (dx * sinA + dy * cosA);

	return { x: tipX, y: tipY };
}

// ─── Point-set interpolation (shape morphing) ───────────────────────────────

// Arc/linear/concave produce point arrays with IDENTICAL length and ordering
// for the same sequence (sample count derives from motion turns, not shape).
// So corresponding points map 1:1 and a shape transition is a per-point lerp.
function lerpPointSet(
	a: MandalaPoint[],
	b: MandalaPoint[],
	t: number
): MandalaPoint[] {
	const n = Math.min(a.length, b.length);
	const out: MandalaPoint[] = new Array(n);
	for (let i = 0; i < n; i++) {
		const pa = a[i]!;
		const pb = b[i]!;
		out[i] = {
			x: pa.x + (pb.x - pa.x) * t,
			y: pa.y + (pb.y - pa.y) * t,
		};
	}
	return out;
}

function pointSetsToPaths(sets: MandalaPoint[][]): SVGPathData[] {
	const out: SVGPathData[] = [];
	for (let i = 0; i < sets.length; i++) {
		const d = pointsToSVGPath(sets[i]!);
		if (d) out.push({ d, tipIndex: i });
	}
	return out;
}


export function pointsToSVGPath(points: MandalaPoint[]): string {
	if (points.length < 2) return "";

	const first = points[0]!;
	let d = `M ${first.x.toFixed(2)} ${first.y.toFixed(2)}`;

	for (let i = 0; i < points.length - 1; i++) {
		const p0 = points[Math.max(0, i - 1)]!;
		const p1 = points[i]!;
		const p2 = points[Math.min(points.length - 1, i + 1)]!;
		const p3 = points[Math.min(points.length - 1, i + 2)]!;

		const cp1x = p1.x + (p2.x - p0.x) / 6;
		const cp1y = p1.y + (p2.y - p0.y) / 6;
		const cp2x = p2.x - (p3.x - p1.x) / 6;
		const cp2y = p2.y - (p3.y - p1.y) / 6;

		d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
	}

	return d;
}

// ─── Normalized motion extraction from StepLike ─────────────────────────────

interface NormalizedMotion {
	motionType: string;
	rotDir: string;
	startLoc: string;
	endLoc: string;
	startOrientation: string;
	endOrientation: string;
	turns: number;
	handPath?: string | null;
}

function extractMotion(
	motion: MotionLike | null | undefined
): NormalizedMotion | null {
	if (!motion) return null;

	const turns =
		typeof motion.turns === "string"
			? parseFloat(motion.turns)
			: (motion.turns ?? 0);

	return {
		motionType: motion.motionType,
		rotDir: motion.rotationDirection,
		startLoc: motion.startLocation,
		endLoc: motion.endLocation,
		startOrientation: motion.startOrientation ?? "out",
		endOrientation: motion.endOrientation ?? "out",
		turns: isNaN(turns) ? 0 : turns,
		handPath: motion.handPath,
	};
}

// ─── Path generation for one hand + one tip ─────────────────────────────────

function generatePathPoints(
	steps: readonly StepLike[],
	hand: "blue" | "red",
	tipOffset: TipOffset,
	gridRadius: number,
	samplesPerBeat: number,
	options?: MandalaPathOptions
): MandalaPoint[] {
	const points: MandalaPoint[] = [];

	// Chain staff angles across beats to prevent junction gaps.
	// Each beat's start staff angle = previous beat's end staff angle.
	let prevEndStaffAngle: number | null = null;

	for (const step of steps) {
		const rawMotion = step.motions?.[hand];
		// invisible placeholder = hand not really there (both-required Step shape)
		if (!isVisibleMotion(rawMotion)) continue;
		const motion = extractMotion(rawMotion);
		if (!motion) continue;

		const endpoints = calculateMotionEndpoints(motion);

		// Staff angle chaining: override start with previous beat's end angle
		if (prevEndStaffAngle !== null) {
			const originalEndStaffAngle = normalizeAnglePositive(
				endpoints.startStaffAngle + endpoints.staffRotationDelta
			);
			endpoints.startStaffAngle = prevEndStaffAngle;

			// Recompute staffRotationDelta relative to the chained start angle.
			// Float is special: the prop holds its absolute spatial angle, so
			// delta stays 0 regardless of chaining.
			if (motion.motionType === "float") {
				endpoints.staffRotationDelta = 0;
			} else if (motion.turns > 0 && !isNoRotation(motion.rotDir)) {
				const dir = parseDirection(motion.rotDir);
				const turnsRotation = dir * motion.turns * PI;

				if (motion.motionType === "pro") {
					endpoints.staffRotationDelta =
						endpoints.centerRotationDelta + turnsRotation;
				} else if (motion.motionType === "anti") {
					endpoints.staffRotationDelta =
						-endpoints.centerRotationDelta + turnsRotation;
				} else {
					// static, dash with turns
					endpoints.staffRotationDelta = turnsRotation;
				}
			} else {
				// No turns: shortest path to orientation-derived end angle
				endpoints.staffRotationDelta = normalizeAngleSigned(
					originalEndStaffAngle - prevEndStaffAngle
				);
			}
		}

		// Track end staff angle for next beat
		prevEndStaffAngle = normalizeAnglePositive(
			endpoints.startStaffAngle + endpoints.staffRotationDelta
		);

		// Adaptive sampling: more samples for high-turn motions
		const turnCount = motion.turns;
		const samples = Math.max(
			samplesPerBeat,
			samplesPerBeat * Math.ceil(Math.max(1, turnCount))
		);

		const pathShape = resolvePathShape(motion.motionType, rawMotion?.pathShape, options);

		for (let i = 0; i <= samples; i++) {
			const t = i / samples;
			const handPos = interpolate(endpoints, t, pathShape);
			const tip = computeTipPosition(handPos, tipOffset, gridRadius);
			points.push(tip);
		}
	}

	return points;
}

// ─── Public module functions ────────────────────────────────────────────────

const cache = new Map<string, MandalaPaths>();
const MAX_CACHE_SIZE = 50;

function buildCacheKey(
	steps: readonly StepLike[],
	bluePropType?: string,
	redPropType?: string,
	options?: MandalaPathOptions
): string {
	const parts: string[] = [];
	for (const step of steps) {
		const b = step.motions?.blue;
		const r = step.motions?.red;
		// Key must track geometry: invisible hands produce no paths, so they
		// must not share a cache key with visible variants of the same motion.
		if (isVisibleMotion(b))
			parts.push(
				b.motionType +
				b.rotationDirection +
				b.startLocation +
				b.endLocation +
				(b.startOrientation ?? '') +
				(b.endOrientation ?? '') +
				(b.handPath ?? '') +
				(b.turns ?? 0)
			);
		if (isVisibleMotion(r))
			parts.push(
				r.motionType +
				r.rotationDirection +
				r.startLocation +
				r.endLocation +
				(r.startOrientation ?? '') +
				(r.endOrientation ?? '') +
				(r.handPath ?? '') +
				(r.turns ?? 0)
			);
	}
	parts.push(bluePropType ?? "staff", redPropType ?? "staff");
	if (options?.pathShape) parts.push("ps:" + options.pathShape);
	if (options?.motionAware) parts.push("ma:1");
	if (options?.tipEnds === 1) parts.push("te:1");
	return parts.join("|");
}

function computePointSets(
	stepsWithMotions: readonly StepLike[],
	options: MandalaPathOptions | undefined,
	tipOverrides?: MandalaTipOverrides | MandalaTipOffset,
): { blue: MandalaPoint[][]; red: MandalaPoint[][] } {
	const defaultDx =
		tipOverrides && "dx" in tipOverrides
			? tipOverrides.dx
			: MANDALA_STANDARD_TIP_DX;
	const defaultDy =
		tipOverrides && "dy" in tipOverrides
			? tipOverrides.dy
			: 0;
	// Legacy callers provide one axial offset plus tipEnds. The animation
	// overlay provides independent point arrays so each hand can follow its
	// current prop's real trail sources, including asymmetric custom points.
	const defaultTips =
		options?.tipEnds === 1
			? [{ dx: defaultDx, dy: defaultDy }]
			: [
					{ dx: -defaultDx, dy: defaultDy },
					{ dx: defaultDx, dy: defaultDy },
				];
	const blueTips =
		tipOverrides && "blue" in tipOverrides
			? tipOverrides.blue
			: defaultTips;
	const redTips =
		tipOverrides && "red" in tipOverrides
			? tipOverrides.red
			: defaultTips;
	const gridRadius = MANDALA_GRID_RADIUS;
	const samplesPerBeat = BASE_SAMPLES_PER_BEAT;

	const blue: MandalaPoint[][] = [];
	const red: MandalaPoint[][] = [];

	for (const tip of blueTips) {
		blue.push(generatePathPoints(stepsWithMotions, "blue", tip, gridRadius, samplesPerBeat, options));
	}
	for (const tip of redTips) {
		red.push(generatePathPoints(stepsWithMotions, "red", tip, gridRadius, samplesPerBeat, options));
	}

	return { blue, red };
}

// Path geometry interpolated between two shapes (optionsFrom → optionsTo) at
// morph progress t∈[0,1]. Point sets share length/ordering across shapes, so
// this is a per-point lerp. Used to morph shape transitions in place while the
// breathing/rotation animation continues. Never cached (called per frame).
export function calculateMorphed(
	steps: readonly StepLike[],
	_bluePropType: string | undefined,
	_redPropType: string | undefined,
	optionsFrom: MandalaPathOptions | undefined,
	optionsTo: MandalaPathOptions | undefined,
	t: number,
	tipOverride?: MandalaTipOverrides | MandalaTipOffset,
): MandalaPaths {
	const stepsWithMotions = steps.filter(
		(s) => isVisibleMotion(s.motions?.blue) || isVisibleMotion(s.motions?.red)
	);
	if (stepsWithMotions.length === 0) {
		return { blue: [], red: [], purple: [] };
	}

	const from = computePointSets(stepsWithMotions, optionsFrom, tipOverride);
	const to = computePointSets(stepsWithMotions, optionsTo, tipOverride);

	const blueSets = from.blue.map((set, i) => lerpPointSet(set, to.blue[i] ?? set, t));
	const redSets = from.red.map((set, i) => lerpPointSet(set, to.red[i] ?? set, t));

	return {
		blue: pointSetsToPaths(blueSets),
		red: pointSetsToPaths(redSets),
		purple: [],
	};
}

export function calculate(
	steps: readonly StepLike[],
	_bluePropType?: string,
	_redPropType?: string,
	options?: MandalaPathOptions,
	tipOverride?: MandalaTipOverrides | MandalaTipOffset,
): MandalaPaths {
	const skipCache = tipOverride !== undefined;

	if (!skipCache) {
		const key = buildCacheKey(steps, _bluePropType, _redPropType, options);
		const cached = cache.get(key);
		if (cached) {
			cache.delete(key);
			cache.set(key, cached);
			return cached;
		}
	}

	// Filter to steps that have motions (skip start position / empty steps).
	// Steps whose hands are all invisible placeholders count as motionless.
	const stepsWithMotions = steps.filter(
		(s) => isVisibleMotion(s.motions?.blue) || isVisibleMotion(s.motions?.red)
	);

	if (stepsWithMotions.length === 0) {
		return { blue: [], red: [], purple: [] };
	}

	const sets = computePointSets(stepsWithMotions, options, tipOverride);
	const result: MandalaPaths = {
		blue: pointSetsToPaths(sets.blue),
		red: pointSetsToPaths(sets.red),
		purple: [],
	};

	if (!skipCache) {
		const key = buildCacheKey(steps, _bluePropType, _redPropType, options);
		if (cache.size >= MAX_CACHE_SIZE) {
			const oldestKey = cache.keys().next().value;
			if (oldestKey !== undefined) cache.delete(oldestKey);
		}
		cache.set(key, result);
	}

	return result;
}
