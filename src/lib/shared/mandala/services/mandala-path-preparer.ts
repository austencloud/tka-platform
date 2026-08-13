/**
 * MandalaPathPreparer
 *
 * Pre-computes Path2D objects, path lengths, and the coordinate transform scale
 * from sequence step data. These are the inputs the progressive-reveal overlay
 * needs to draw smooth bezier paths via setLineDash/lineDashOffset.
 *
 * Wraps MandalaGeometryCalculator (which produces SVG path `d` strings) and
 * converts the output into canvas-ready Path2D objects with measured lengths.
 */

import {
	MANDALA_GRID_RADIUS,
	ENGINE_GRID_RADIUS,
} from "../domain/mandala-constants";
import { VIEWBOX_SIZE } from "$lib/shared/render/core/constants/viewbox";
import type { SVGPathData } from "../domain/mandala-types";
import type {
	MandalaPathOptions,
	MandalaTipOffset,
	PreparedMandalaPath,
	PreparedMandalaPaths,
	StepLike,
} from "./types";
import { calculate as calculateMandalaGeometry } from "./mandala-geometry-calculator";
import { isVisibleMotion } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import {
	getTipPoints,
	getTipPointsBaseline,
	type TipPoint,
} from "$lib/shared/animation-engine/domain/types/prop-tip-points";
import {
	getDefaultTrailPointConfig,
	resolveTrailPointConfig,
	type TrailPointSource,
} from "$lib/shared/animation-engine/domain/types/trail-point-types";
import { TrackingMode } from "$lib/shared/animation-engine/domain/types/trail-types";
import { propTipEnds } from "$lib/shared/pictograph/prop/domain/prop-tip-ends";

// ─── Path length measurement ───────────────────────────────────────────────

/**
 * Measures the total length of an SVG path string by creating a temporary
 * SVGPathElement. This is the only reliable way to get path length for
 * arbitrary bezier curves without reimplementing the math.
 */
function measurePathLength(d: string): number {
	const temp = document.createElementNS("http://www.w3.org/2000/svg", "path");
	temp.setAttribute("d", d);
	return temp.getTotalLength();
}

// ─── Scale calculation ─────────────────────────────────────────────────────

/**
 * Maps mandala coordinates directly into the animation engine's coordinate
 * system. The mandala hand circle (radius 80) lands on the engine hand orbit
 * (radius 150), while each prop-local tip offset retains its exact length.
 */
export function computeEngineAlignedMandalaScale(canvasSize: number): number {
	return (
		(canvasSize / VIEWBOX_SIZE) * (ENGINE_GRID_RADIUS / MANDALA_GRID_RADIUS)
	);
}

// ─── Trail-source resolution ───────────────────────────────────────────────

function sourceToOffset(
	source: TrailPointSource,
	points: readonly TipPoint[]
): MandalaTipOffset | null {
	if (source.type === "none") return null;
	if (source.type === "custom") return { dx: source.dx, dy: source.dy };
	// Must read the SAME array resolveTrailPointConfig indexed into. It used to
	// select the index from the override list and then look it up in the
	// baseline list; the two order a prop's arms differently (triad's arms are
	// 120 degrees apart between them, torch's are 180), so the mandala traced a
	// different arm than the trail drew from.
	const point = points[source.index];
	return point ? { dx: point.dx, dy: point.dy } : null;
}

/**
 * Resolve the physical points selected by the trail system for one prop.
 *
 * This mirrors TrailCapturer's endpoint routing: single-ended props always use
 * their one physical source; bilateral props respect Pinky/Thumb/Both; Hand
 * follows the prop center. Duplicate logical sources collapse to one path.
 */
export function resolveMandalaTipOffsets(
	propType: string | null | undefined,
	trackingMode: TrackingMode,
	pointMode: "effective" | "baseline" = "effective"
): MandalaTipOffset[] {
	// Static sequence mandalas use the shipped prop geometry. Live animation
	// overlays use effective points so Effects Lab assignments still line up with
	// the trails on screen.
	const points =
		pointMode === "baseline"
			? getTipPointsBaseline(propType).points
			: getTipPoints(propType).points;
	const config =
		pointMode === "baseline" && trackingMode !== TrackingMode.HAND
			? getDefaultTrailPointConfig(propType, points)
			: resolveTrailPointConfig(propType, trackingMode);
	const sources: TrailPointSource[] = [];
	const hasTwoEnds = propTipEnds(propType ?? undefined) === 2;

	if (!hasTwoEnds) {
		sources.push(config.right);
	} else {
		if (
			trackingMode === TrackingMode.LEFT_END ||
			trackingMode === TrackingMode.BOTH_ENDS
		) {
			sources.push(config.left);
		}
		if (
			trackingMode === TrackingMode.RIGHT_END ||
			trackingMode === TrackingMode.BOTH_ENDS ||
			trackingMode === TrackingMode.HAND
		) {
			sources.push(config.right);
		}
	}

	const unique = new Map<string, MandalaTipOffset>();
	for (const source of sources) {
		const point = sourceToOffset(source, points);
		if (!point) continue;
		const key = `${point.dx}:${point.dy}`;
		if (!unique.has(key)) unique.set(key, point);
	}
	return [...unique.values()];
}

// ─── SVGPathData → PreparedMandalaPath conversion ──────────────────────────

function preparePaths(
	svgPaths: SVGPathData[],
	color: string,
	hand: "blue" | "red"
): PreparedMandalaPath[] {
	const result: PreparedMandalaPath[] = [];

	for (const pathData of svgPaths) {
		if (!pathData.d) continue;

		const path2d = new Path2D(pathData.d);
		const totalLength = measurePathLength(pathData.d);

		// Skip degenerate paths with no measurable length
		if (totalLength <= 0) continue;

		result.push({ path2d, totalLength, color, hand });
	}

	return result;
}

// ─── Public class ──────────────────────────────────────────────────────────

export class MandalaPathPreparer {
	// Simple cache: store the last computation and only recompute when inputs change
	private cachedSteps: readonly StepLike[] | null = null;
	private cachedCanvasSize: number = 0;
	private cachedKey = "";
	private cachedResult: PreparedMandalaPaths | null = null;

	prepare(
		steps: readonly StepLike[],
		canvasSize: number,
		options: {
			show: "blue" | "red" | "both";
			bluePropType: string | null | undefined;
			redPropType: string | null | undefined;
			trackingMode: TrackingMode;
			pathOptions?: MandalaPathOptions;
			blueColor: string;
			redColor: string;
			sequenceKey?: string;
		}
	): PreparedMandalaPaths | null {
		const blueTips = resolveMandalaTipOffsets(
			options.bluePropType,
			options.trackingMode
		);
		const redTips = resolveMandalaTipOffsets(
			options.redPropType,
			options.trackingMode
		);
		const cacheKey = [
			options.sequenceKey ?? "",
			options.show,
			options.bluePropType?.toLowerCase() ?? "",
			options.redPropType?.toLowerCase() ?? "",
			options.trackingMode,
			options.pathOptions?.pathShape ?? "arc",
			options.pathOptions?.motionAware ? "motion-aware" : "fixed",
			options.blueColor,
			options.redColor,
			blueTips.map((p) => `${p.dx},${p.dy}`).join(";"),
			redTips.map((p) => `${p.dx},${p.dy}`).join(";"),
		].join("|");

		// Return cached result if inputs haven't changed
		if (
			this.cachedSteps === steps &&
			this.cachedCanvasSize === canvasSize &&
			this.cachedKey === cacheKey &&
			this.cachedResult !== null
		) {
			return this.cachedResult;
		}

		// Count motion steps (steps that have at least one VISIBLE hand with
		// motion data — invisible placeholders don't count). This matches the
		// filtering MandalaGeometryCalculator does internally.
		const stepsWithMotions = steps.filter(
			(s) => isVisibleMotion(s.motions?.blue) || isVisibleMotion(s.motions?.red)
		);

		if (stepsWithMotions.length === 0) {
			this.cacheResult(steps, canvasSize, cacheKey, null);
			return null;
		}

		// Compute SVG path geometry from the sequence steps
		const mandalaPaths = calculateMandalaGeometry(
			steps,
			options.bluePropType ?? undefined,
			options.redPropType ?? undefined,
			options.pathOptions,
			{ blue: blueTips, red: redTips }
		);

		// Convert SVG paths to canvas Path2D objects with measured lengths
		const allPaths: PreparedMandalaPath[] = [];

		if (options.show === "blue" || options.show === "both") {
			allPaths.push(
				...preparePaths(mandalaPaths.blue, options.blueColor, "blue")
			);
		}

		if (options.show === "red" || options.show === "both") {
			allPaths.push(...preparePaths(mandalaPaths.red, options.redColor, "red"));
		}

		if (allPaths.length === 0) {
			this.cacheResult(steps, canvasSize, cacheKey, null);
			return null;
		}

		const result: PreparedMandalaPaths = {
			paths: allPaths,
			scale: computeEngineAlignedMandalaScale(canvasSize),
			totalSteps: stepsWithMotions.length,
		};

		this.cacheResult(steps, canvasSize, cacheKey, result);
		return result;
	}

	clearCache(): void {
		this.cachedSteps = null;
		this.cachedCanvasSize = 0;
		this.cachedKey = "";
		this.cachedResult = null;
	}

	private cacheResult(
		steps: readonly StepLike[],
		canvasSize: number,
		cacheKey: string,
		result: PreparedMandalaPaths | null
	): void {
		this.cachedSteps = steps;
		this.cachedCanvasSize = canvasSize;
		this.cachedKey = cacheKey;
		this.cachedResult = result;
	}
}
