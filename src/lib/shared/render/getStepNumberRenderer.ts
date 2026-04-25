import { browser } from '$app/environment';
import type { IStepNumberRenderer } from './services/contracts/IStepNumberRenderer';
import { StepNumberRenderer } from './services/implementations/StepNumberRenderer';

let instance: IStepNumberRenderer | null = null;

export function getStepNumberRenderer(): IStepNumberRenderer {
	if (!browser) throw new Error('getStepNumberRenderer() is browser-only');
	return instance ??= new StepNumberRenderer();
}
