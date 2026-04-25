import { browser } from '$app/environment';
import type { IStepConverter } from './services/contracts/IStepConverter';
import { StepConverter } from './services/implementations/StepConverter';

let instance: IStepConverter | null = null;

export function getStepConverter(): IStepConverter {
	if (!browser) throw new Error('getStepConverter() is browser-only');
	return instance ??= new StepConverter();
}
