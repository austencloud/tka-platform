import type { MandalaPaths } from "../../domain/mandala-types";

export interface IMandalaGeometryCalculator {
	calculate(
		steps: readonly StepLike[],
		bluePropType?: string,
		redPropType?: string
	): MandalaPaths;
}

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
}
