import { browser } from '$app/environment';
import type { IStepMotionDeriver } from './services/contracts/IStepMotionDeriver';
import { StepMotionDeriver } from './services/implementations/StepMotionDeriver';

let instance: IStepMotionDeriver | null = null;

export function getStepMotionDeriver(): IStepMotionDeriver {
	if (!browser) throw new Error('getStepMotionDeriver() is browser-only');
	return instance ??= new StepMotionDeriver();
}
