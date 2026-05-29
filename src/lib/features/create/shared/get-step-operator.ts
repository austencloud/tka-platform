import { browser } from '$app/environment';
import { StepOperator } from './services/step-operator';
import { motionQueryHandler } from '$lib/shared/pictograph/shared/services/implementations/MotionQueryHandler';

let instance: StepOperator | null = null;

export function getStepOperator(): StepOperator {
	if (!browser) throw new Error('getStepOperator() is browser-only');
	return instance ??= new StepOperator(motionQueryHandler);
}
