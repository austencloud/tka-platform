import { browser } from '$app/environment';
import { StepConverter } from './services/implementations/StepConverter';

let instance: StepConverter | null = null;

export function getStepConverter(): StepConverter {
	if (!browser) throw new Error('getStepConverter() is browser-only');
	return instance ??= new StepConverter();
}
