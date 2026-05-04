import { browser } from '$app/environment';

import { GapDetector } from './services/implementations/GapDetector';

let instance: GapDetector | null = null;

export function getGapDetector(): GapDetector {
	if (!browser) throw new Error('getGapDetector() is browser-only');
	return instance ??= new GapDetector();
}
