import { browser } from '$app/environment';

import { FirstStepAnalyzer } from './services/implementations/FirstStepAnalyzer';

let instance: FirstStepAnalyzer | null = null;

export function getFirstStepAnalyzer(): FirstStepAnalyzer {
	if (!browser) throw new Error('getFirstStepAnalyzer() is browser-only');
	return instance ??= new FirstStepAnalyzer();
}
