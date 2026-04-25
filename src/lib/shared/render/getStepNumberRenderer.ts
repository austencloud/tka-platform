import { browser } from '$app/environment';
import type { IStepNumberRenderer } from './services/contracts/IStepNumberRenderer';
import { StepNumberRenderer } from './services/implementations/StepNumberRenderer';

let instance: IStepNumberRenderer | null = null;

export function getBeatNumberRenderer(): IStepNumberRenderer {
	if (!browser) throw new Error('getBeatNumberRenderer() is browser-only');
	return instance ??= new StepNumberRenderer();
}
