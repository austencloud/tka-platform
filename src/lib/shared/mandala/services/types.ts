// --- From MandalaGeometryCalculator ---
export interface StepLike {
	motions?: {
		blue?: MotionLike | null;
		red?: MotionLike | null;
	} | null;
}

export interface MotionLike {
	motionType: string;
	rotationDirection: string;
	startLocation: string;
	endLocation: string;
	turns?: number | string;
	startOrientation?: string;
	endOrientation?: string;
	pathShape?: "arc" | "linear" | "concave";
	/** false = invisible placeholder — hand not really there (both-required Step shape) */
	isVisible?: boolean;
}

export interface MandalaPathOptions {
	pathShape?: "arc" | "linear" | "concave";
	motionAware?: boolean;
	/**
	 * Prop end-points traced: 2 = a two-ended prop (staff), both tips drawn; 1 =
	 * a single-ended prop (club), only the outer tip. One end halves the path
	 * count, so the busiest high-turn mandalas read far less overwhelming.
	 * Default 2.
	 */
	tipEnds?: 1 | 2;
}


// --- From MandalaPathPreparer ---
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
