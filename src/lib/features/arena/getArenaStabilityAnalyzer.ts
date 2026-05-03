import { browser } from '$app/environment';

import { StabilityAnalyzer } from './services/implementations/StabilityAnalyzer';

let instance: StabilityAnalyzer | null = null;

export function getArenaStabilityAnalyzer(): StabilityAnalyzer {
	if (!browser) throw new Error('getArenaStabilityAnalyzer() is browser-only');
	return instance ??= new StabilityAnalyzer();
}
