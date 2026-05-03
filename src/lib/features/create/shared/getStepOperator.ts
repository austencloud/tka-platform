import { browser } from '$app/environment';
import { StepOperator } from './services/implementations/StepOperator';
import { motionQueryHandler } from '$lib/shared/pictograph/shared/services/implementations/MotionQueryHandler';
import { gridModeDeriver } from '$lib/shared/pictograph/grid/services/implementations/GridModeDeriver';

let instance: StepOperator | null = null;

export function getStepOperator(): StepOperator {
	if (!browser) throw new Error('getStepOperator() is browser-only');
	return instance ??= new StepOperator(motionQueryHandler, gridModeDeriver);
}
