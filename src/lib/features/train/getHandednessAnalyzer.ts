import { browser } from '$app/environment';

import { HandednessAnalyzer } from './services/implementations/HandednessAnalyzer';

let instance: HandednessAnalyzer | null = null;

export function getHandednessAnalyzer(): HandednessAnalyzer {
	if (!browser) throw new Error('getHandednessAnalyzer() is browser-only');
	return instance ??= new HandednessAnalyzer();
}
