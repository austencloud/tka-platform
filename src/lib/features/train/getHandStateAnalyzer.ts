import { browser } from '$app/environment';

import { HandStateAnalyzer } from './services/implementations/HandStateAnalyzer';

let instance: HandStateAnalyzer | null = null;

export function getHandStateAnalyzer(): HandStateAnalyzer {
	if (!browser) throw new Error('getHandStateAnalyzer() is browser-only');
	return instance ??= new HandStateAnalyzer();
}
