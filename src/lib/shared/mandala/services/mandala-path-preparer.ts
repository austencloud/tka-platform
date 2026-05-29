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
	BLUE_STROKE,
	RED_STROKE,
	MANDALA_STANDARD_TIP_DX,
	MANDALA_GRID_RADIUS,
	ENGINE_GRID_RADIUS,
} from "../domain/mandala-constants";
import type { SVGPathData } from "../domain/mandala-types";
import type { PreparedMandalaPath, PreparedMandalaPaths } from "./types";
import type { StepLike } from "./types";
import { MandalaGeometryCalculator } from "./mandala-geometry-calculator";

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
 * Computes the coordinate transform scale that maps mandala geometry coordinates
 * to canvas pixel coordinates. This is the same formula used by MandalaRenderer
 * so the overlay aligns perfectly with the static mandala.
 *
 * tipReach = how far a staff tip extends beyond the grid circle
 * maxExtent = grid radius + tip reach (the bounding circle of all possible paths)
 * scale = canvasCenter / (maxExtent * 1.05) with 5% padding
 */
function computeScale(canvasSize: number): number {
	const tipReach =
		(MANDALA_STANDARD_TIP_DX * MANDALA_GRID_RADIUS) /
		ENGINE_GRID_RADIUS;
	const maxExtent = MANDALA_GRID_RADIUS + tipReach;
	return canvasSize / 2 / (maxExtent * 1.05);
}

// ─── SVGPathData → PreparedMandalaPath conversion ──────────────────────────

function preparePaths(
	svgPaths: SVGPathData[],
	color: string,
): PreparedMandalaPath[] {
	const result: PreparedMandalaPath[] = [];

	for (const pathData of svgPaths) {
		if (!pathData.d) continue;

		const path2d = new Path2D(pathData.d);
		const totalLength = measurePathLength(pathData.d);

		// Skip degenerate paths with no measurable length
		if (totalLength <= 0) continue;

		result.push({ path2d, totalLength, color });
	}

	return result;
}

// ─── Public class ──────────────────────────────────────────────────────────

export class MandalaPathPreparer {
	private readonly geometryCalculator = new MandalaGeometryCalculator();

	// Simple cache: store the last computation and only recompute when inputs change
	private cachedSteps: readonly StepLike[] | null = null;
	private cachedCanvasSize: number = 0;
	private cachedShow: "blue" | "red" | "both" = "both";
	private cachedResult: PreparedMandalaPaths | null = null;

	prepare(
		steps: readonly StepLike[],
		canvasSize: number,
		show: "blue" | "red" | "both",
	): PreparedMandalaPaths | null {
		// Return cached result if inputs haven't changed
		if (
			this.cachedSteps === steps &&
			this.cachedCanvasSize === canvasSize &&
			this.cachedShow === show &&
			this.cachedResult !== null
		) {
			return this.cachedResult;
		}

		// Count motion steps (steps that have at least one hand with motion data).
		// This matches the filtering MandalaGeometryCalculator does internally.
		const stepsWithMotions = steps.filter(
			(s) => s.motions?.blue || s.motions?.red,
		);

		if (stepsWithMotions.length === 0) {
			this.cacheResult(steps, canvasSize, show, null);
			return null;
		}

		// Compute SVG path geometry from the sequence steps
		const mandalaPaths = this.geometryCalculator.calculate(steps);

		// Convert SVG paths to canvas Path2D objects with measured lengths
		const allPaths: PreparedMandalaPath[] = [];

		if (show === "blue" || show === "both") {
			allPaths.push(...preparePaths(mandalaPaths.blue, BLUE_STROKE));
		}

		if (show === "red" || show === "both") {
			allPaths.push(...preparePaths(mandalaPaths.red, RED_STROKE));
		}

		if (allPaths.length === 0) {
			this.cacheResult(steps, canvasSize, show, null);
			return null;
		}

		const result: PreparedMandalaPaths = {
			paths: allPaths,
			scale: computeScale(canvasSize),
			totalSteps: stepsWithMotions.length,
		};

		this.cacheResult(steps, canvasSize, show, result);
		return result;
	}

	private cacheResult(
		steps: readonly StepLike[],
		canvasSize: number,
		show: "blue" | "red" | "both",
		result: PreparedMandalaPaths | null,
	): void {
		this.cachedSteps = steps;
		this.cachedCanvasSize = canvasSize;
		this.cachedShow = show;
		this.cachedResult = result;
	}
}
