import { browser } from '$app/environment';
import { StepMotionDeriver } from './services/implementations/StepMotionDeriver';

let instance: StepMotionDeriver | null = null;

export function getStepMotionDeriver(): StepMotionDeriver {
	if (!browser) throw new Error('getStepMotionDeriver() is browser-only');
	return instance ??= new StepMotionDeriver();
}
