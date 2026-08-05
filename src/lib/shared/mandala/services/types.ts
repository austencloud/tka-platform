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
	handPath?: string | null;
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

/**
 * One prop-local point whose path the mandala should trace.
 *
 * These offsets use the animation engine's 950-unit coordinate space. The
 * geometry calculator scales them into mandala space, then the animation
 * overlay scales them back into the live canvas. Keeping the original offset
 * intact is what makes a club, staff, fan, or custom trail point land on the
 * same pixels as its rendered trail.
 */
export interface MandalaTipOffset {
	dx: number;
	dy: number;
}

/** Per-hand tip points used when blue and red props have different geometry. */
export interface MandalaTipOverrides {
	blue: readonly MandalaTipOffset[];
	red: readonly MandalaTipOffset[];
}


// --- From MandalaPathPreparer ---
export interface PreparedMandalaPath {
	path2d: Path2D;
	totalLength: number;
	color: string;
	hand: "blue" | "red";
}

export interface PreparedMandalaPaths {
	paths: PreparedMandalaPath[];
	/** Transform scale: canvasCenter / (maxExtent * 1.05) */
	scale: number;
	/** Total number of motion steps (for progress calculation) */
	totalSteps: number;
}
