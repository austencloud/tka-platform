import { browser } from '$app/environment';
import type { IStepBoundaryDetector } from './services/contracts/IStepBoundaryDetector';
import { StepBoundaryDetector } from './services/implementations/StepBoundaryDetector';

let instance: IStepBoundaryDetector | null = null;

export function getStepBoundaryDetector(): IStepBoundaryDetector {
	if (!browser) throw new Error('getStepBoundaryDetector() is browser-only');
	return instance ??= new StepBoundaryDetector();
}
