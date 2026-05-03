import { browser } from '$app/environment';
import { StepNumberRenderer } from './services/implementations/StepNumberRenderer';

let instance: StepNumberRenderer | null = null;

export function getStepNumberRenderer(): StepNumberRenderer {
	if (!browser) throw new Error('getStepNumberRenderer() is browser-only');
	return instance ??= new StepNumberRenderer();
}
