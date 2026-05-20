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
}

export interface MandalaPathOptions {
	pathShape?: "arc" | "linear" | "concave";
	motionAware?: boolean;
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
