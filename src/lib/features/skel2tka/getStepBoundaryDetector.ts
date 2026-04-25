import { browser } from '$app/environment';
import type { IStepBoundaryDetector } from './services/contracts/IBeatBoundaryDetector';
import { StepBoundaryDetector } from './services/implementations/BeatBoundaryDetector';

let instance: IStepBoundaryDetector | null = null;

export function getStepBoundaryDetector(): IStepBoundaryDetector {
	if (!browser) throw new Error('getStepBoundaryDetector() is browser-only');
	return instance ??= new StepBoundaryDetector();
}
