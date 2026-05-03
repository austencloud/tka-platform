import { browser } from '$app/environment';

import { StepBoundaryDetector } from './services/implementations/StepBoundaryDetector';

let instance: StepBoundaryDetector | null = null;

export function getStepBoundaryDetector(): StepBoundaryDetector {
	if (!browser) throw new Error('getStepBoundaryDetector() is browser-only');
	return instance ??= new StepBoundaryDetector();
}
