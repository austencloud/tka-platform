import { browser } from '$app/environment';
import type { IFirstStepAnalyzer } from './services/contracts/IFirstStepAnalyzer';
import { FirstStepAnalyzer } from './services/implementations/FirstStepAnalyzer';

let instance: IFirstStepAnalyzer | null = null;

export function getFirstStepAnalyzer(): IFirstStepAnalyzer {
	if (!browser) throw new Error('getFirstStepAnalyzer() is browser-only');
	return instance ??= new FirstStepAnalyzer();
}
