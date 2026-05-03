import { browser } from '$app/environment';
import { BuilderStepConverter } from './services/implementations/BuilderStepConverter';

let instance: BuilderStepConverter | null = null;

export function getBuilderStepConverter(): BuilderStepConverter {
	if (!browser) throw new Error('getBuilderStepConverter() is browser-only');
	return instance ??= new BuilderStepConverter();
}
