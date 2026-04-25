import { browser } from '$app/environment';
import type { IStepDataConverter } from './services/contracts/IStepDataConverter';
import { StepDataConverter } from './services/implementations/StepDataConverter';

let instance: IStepDataConverter | null = null;

export function getStepDataConverter(): IStepDataConverter {
	if (!browser) throw new Error('getStepDataConverter() is browser-only');
	return instance ??= new StepDataConverter();
}
