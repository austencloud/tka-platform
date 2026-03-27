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
} from "$lib/features/compose/services/implementations/AngleCalculator";
import {
	LOCATION_ANGLES,
	PI,
	TWO_PI,
} from "$lib/features/compose/shared/domain/math-constants";
import { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
	DEFAULT_TIP_INSET_PX,
	BASE_SAMPLES_PER_BEAT,
	MANDALA_GRID_RADIUS,
	ENGINE_GRID_RADIUS,
} from "../../domain/mandala-constants";
import type {
	MandalaPaths,
	SVGPathData,
	MandalaPoint,
} from "../../domain/mandala-types";
import type {
	IMandalaGeometryCalculator,
	StepLike,
	MotionLike,
} from "../contracts/IMandalaGeometryCalculator";

// ─── Internal types ─────────────────────────────────────────────────────────

interface TipOffset {
	dx: number;
	dy: number;
}

interface MotionEndpoints {
	startCenterAngle: number;
	targetCenterAngle: number;
	startStaffAngle: number;
	staffRotationDelta: number;
	motionType: string;
}

interface InterpolatedPosition {
	x: number;
	y: number;
	staffAngle: number;
}

// ─── Location angle lookup ──────────────────────────────────────────────────

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

// ─── Orientation string to enum mapping ─────────────────────────────────────

// The existing mapOrientationToAngle expects Orientation enum values.
// Firestore data stores lowercase strings. Map them.

function resolveOrientationAngle(
	ori: string | undefined,
	centerAngle: number
): number {
	const orientationMap: Record<string, Orientation> = {
		in: Orientation.IN,
		out: Orientation.OUT,
		clock: Orientation.CLOCK,
		counter: Orientation.COUNTER,
	};

	const enumValue = orientationMap[ori ?? "out"] ?? Orientation.OUT;
	return mapOrientationToAngle(enumValue, centerAngle);
}

// ─── Rotation direction parsing ─────────────────────────────────────────────

function parseDirection(rotDir: string): number {
	if (rotDir === "ccw" || rotDir === "counter_clockwise") return -1;
	// "cw", "clockwise", "noRotation", or anything else
	return 1;
}

function isNoRotation(rotDir: string): boolean {
	return rotDir === "noRotation" || rotDir === "no_rotation";
}

// ─── Endpoint calculation ───────────────────────────────────────────────────

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
}): MotionEndpoints {
	const startCenterAngle = resolveLocationAngle(motion.startLoc);
	const targetCenterAngle = resolveLocationAngle(motion.endLoc);

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
			const centerMovement = normalizeAngleSigned(
				targetCenterAngle - startCenterAngle
			);
			const propRotation = dir * turns * PI;
			staffRotationDelta = centerMovement + propRotation;
			break;
		}
		case "anti": {
			const centerMovement = normalizeAngleSigned(
				targetCenterAngle - startCenterAngle
			);
			const propRotation = dir * turns * PI;
			staffRotationDelta = -centerMovement + propRotation;
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
		startStaffAngle,
		staffRotationDelta,
		motionType: motion.motionType,
	};
}

// ─── Interpolation ──────────────────────────────────────────────────────────

// lerpAngle: shortest-path angular interpolation
function lerpAngle(a: number, b: number, t: number): number {
	const d = normalizeAngleSigned(b - a);
	return normalizeAnglePositive(a + d * t);
}

function interpolate(
	endpoints: MotionEndpoints,
	t: number
): InterpolatedPosition {
	const {
		startCenterAngle,
		targetCenterAngle,
		startStaffAngle,
		staffRotationDelta,
		motionType,
	} = endpoints;

	const staffAngle = normalizeAnglePositive(
		startStaffAngle + staffRotationDelta * t
	);

	if (motionType === "dash") {
		// Cartesian lerp (straight line through center)
		const startX = Math.cos(startCenterAngle);
		const startY = Math.sin(startCenterAngle);
		const endX = Math.cos(targetCenterAngle);
		const endY = Math.sin(targetCenterAngle);
		const x = startX + (endX - startX) * t;
		const y = startY + (endY - startY) * t;
		return { x, y, staffAngle };
	}

	if (motionType === "static" || motionType === "float") {
		// Hand stays at start position
		const x = Math.cos(startCenterAngle);
		const y = Math.sin(startCenterAngle);
		return { x, y, staffAngle };
	}

	// Arc interpolation (PRO, ANTI)
	const centerAngle = lerpAngle(startCenterAngle, targetCenterAngle, t);
	const x = Math.cos(centerAngle);
	const y = Math.sin(centerAngle);
	return { x, y, staffAngle };
}

// ─── Tip position transform ─────────────────────────────────────────────────

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

// ─── Catmull-Rom to Bezier SVG path conversion ─────────────────────────────

function pointsToSVGPath(points: MandalaPoint[]): string {
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
	};
}

// ─── Path generation for one hand + one tip ─────────────────────────────────

function generatePathPoints(
	steps: readonly StepLike[],
	hand: "blue" | "red",
	tipOffset: TipOffset,
	gridRadius: number,
	samplesPerBeat: number
): MandalaPoint[] {
	const points: MandalaPoint[] = [];

	// Chain staff angles across beats to prevent junction gaps.
	// Each beat's start staff angle = previous beat's end staff angle.
	let prevEndStaffAngle: number | null = null;

	for (const step of steps) {
		const rawMotion = step.motions?.[hand];
		const motion = extractMotion(rawMotion);
		if (!motion) continue;

		// Float produces no path (no movement, no rotation)
		if (motion.motionType === "float") continue;

		const endpoints = calculateMotionEndpoints(motion);

		// Staff angle chaining: override start with previous beat's end angle
		if (prevEndStaffAngle !== null) {
			const originalEndStaffAngle = normalizeAnglePositive(
				endpoints.startStaffAngle + endpoints.staffRotationDelta
			);
			endpoints.startStaffAngle = prevEndStaffAngle;

			// Recompute staffRotationDelta relative to the chained start angle
			if (motion.turns > 0 && !isNoRotation(motion.rotDir)) {
				const dir = parseDirection(motion.rotDir);
				const turnsRotation = dir * motion.turns * PI;

				if (motion.motionType === "pro") {
					const centerMovement = normalizeAngleSigned(
						endpoints.targetCenterAngle - endpoints.startCenterAngle
					);
					endpoints.staffRotationDelta =
						centerMovement + turnsRotation;
				} else if (motion.motionType === "anti") {
					const centerMovement = normalizeAngleSigned(
						endpoints.targetCenterAngle - endpoints.startCenterAngle
					);
					endpoints.staffRotationDelta =
						-centerMovement + turnsRotation;
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

		for (let i = 0; i <= samples; i++) {
			const t = i / samples;
			const handPos = interpolate(endpoints, t);
			const tip = computeTipPosition(handPos, tipOffset, gridRadius);
			points.push(tip);
		}
	}

	return points;
}

// ─── Staff tip offsets ──────────────────────────────────────────────────────

// Default staff: left tip at dx=-150 (0 endType), right tip at dx=+150 (1 endType).
// Inset by DEFAULT_TIP_INSET_PX so 0-turn motions still produce visible lobes
// instead of collapsing to a single line.

function getStaffTipOffsets(): { left: TipOffset; right: TipOffset } {
	const halfLength = ENGINE_GRID_RADIUS; // 150
	const inset = DEFAULT_TIP_INSET_PX;

	return {
		left: { dx: -(halfLength - inset), dy: 0 },
		right: { dx: halfLength - inset, dy: 0 },
	};
}

// ─── Public class ───────────────────────────────────────────────────────────

export class MandalaGeometryCalculator implements IMandalaGeometryCalculator {
	private cache = new Map<string, MandalaPaths>();
	private static MAX_CACHE_SIZE = 50;

	private buildCacheKey(
		steps: readonly StepLike[],
		bluePropType?: string,
		redPropType?: string
	): string {
		const parts: string[] = [];
		for (const step of steps) {
			const b = step.motions?.blue;
			const r = step.motions?.red;
			if (b)
				parts.push(
					b.motionType + b.startLocation + b.endLocation + (b.turns ?? 0)
				);
			if (r)
				parts.push(
					r.motionType + r.startLocation + r.endLocation + (r.turns ?? 0)
				);
		}
		parts.push(bluePropType ?? "staff", redPropType ?? "staff");
		return parts.join("|");
	}

	calculate(
		steps: readonly StepLike[],
		_bluePropType?: string,
		_redPropType?: string
	): MandalaPaths {
		// Check cache first
		const key = this.buildCacheKey(steps, _bluePropType, _redPropType);
		const cached = this.cache.get(key);
		if (cached) {
			// Move to end (most recently used) by deleting and re-inserting
			this.cache.delete(key);
			this.cache.set(key, cached);
			return cached;
		}

		// Filter to steps that have motions (skip start position / empty steps)
		const stepsWithMotions = steps.filter(
			(s) => s.motions?.blue || s.motions?.red
		);

		if (stepsWithMotions.length === 0) {
			return { blue: [], red: [] };
		}

		// For this initial implementation, default to staff tip offsets.
		// The prop type parameters are accepted for future tip-lookup wiring.
		const tips = getStaffTipOffsets();

		const gridRadius = MANDALA_GRID_RADIUS;
		const samplesPerBeat = BASE_SAMPLES_PER_BEAT;

		// Generate points for each hand + tip combination
		const blueLeftPoints = generatePathPoints(
			stepsWithMotions,
			"blue",
			tips.left,
			gridRadius,
			samplesPerBeat
		);
		const blueRightPoints = generatePathPoints(
			stepsWithMotions,
			"blue",
			tips.right,
			gridRadius,
			samplesPerBeat
		);
		const redLeftPoints = generatePathPoints(
			stepsWithMotions,
			"red",
			tips.left,
			gridRadius,
			samplesPerBeat
		);
		const redRightPoints = generatePathPoints(
			stepsWithMotions,
			"red",
			tips.right,
			gridRadius,
			samplesPerBeat
		);

		// Convert point arrays to SVG path data
		const blue: SVGPathData[] = [];
		const red: SVGPathData[] = [];

		const blueLeftD = pointsToSVGPath(blueLeftPoints);
		if (blueLeftD) blue.push({ d: blueLeftD, endType: 0 });

		const blueRightD = pointsToSVGPath(blueRightPoints);
		if (blueRightD) blue.push({ d: blueRightD, endType: 1 });

		const redLeftD = pointsToSVGPath(redLeftPoints);
		if (redLeftD) red.push({ d: redLeftD, endType: 0 });

		const redRightD = pointsToSVGPath(redRightPoints);
		if (redRightD) red.push({ d: redRightD, endType: 1 });

		const result = { blue, red };

		// Cache the result with LRU eviction if needed
		if (this.cache.size >= MandalaGeometryCalculator.MAX_CACHE_SIZE) {
			// Delete oldest entry (first key in Map iteration order)
			const oldestKey = this.cache.keys().next().value;
			if (oldestKey !== undefined) this.cache.delete(oldestKey);
		}
		this.cache.set(key, result);

		return result;
	}
}
