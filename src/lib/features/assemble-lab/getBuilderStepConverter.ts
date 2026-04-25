import { browser } from '$app/environment';
import type { IBuilderStepConverter } from './services/contracts/IBuilderStepConverter';
import { BuilderStepConverter } from './services/implementations/BuilderStepConverter';

let instance: IBuilderStepConverter | null = null;

export function getBuilderStepConverter(): IBuilderStepConverter {
	if (!browser) throw new Error('getBuilderStepConverter() is browser-only');
	return instance ??= new BuilderStepConverter();
}
