import { browser } from '$app/environment';
import { StepDataConverter } from './services/implementations/StepDataConverter';

let instance: StepDataConverter | null = null;

export function getStepDataConverter(): StepDataConverter {
	if (!browser) throw new Error('getStepDataConverter() is browser-only');
	return instance ??= new StepDataConverter();
}
