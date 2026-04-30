import type { StepLike } from "./IMandalaGeometryCalculator";

export interface PreparedMandalaPath {
	path2d: Path2D;
	totalLength: number;
	color: string;
}

export interface PreparedMandalaPaths {
	paths: PreparedMandalaPath[];
	/** Transform scale: canvasCenter / (maxExtent * 1.05) */
	scale: number;
	/** Total number of motion steps (for progress calculation) */
	totalSteps: number;
}

export interface IMandalaPathPreparer {
	/**
	 * Pre-compute Path2D objects, path lengths, and transform scale from sequence data.
	 * Returns null if no valid paths can be computed.
	 * Caches results - only recomputes when steps change.
	 */
	prepare(
		steps: readonly StepLike[],
		canvasSize: number,
		show: "blue" | "red" | "both",
	): PreparedMandalaPaths | null;
}
