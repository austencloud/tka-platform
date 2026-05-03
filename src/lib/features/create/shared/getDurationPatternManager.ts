import { browser } from '$app/environment';

import { DurationPatternManager } from './services/implementations/DurationPatternManager';

let instance: DurationPatternManager | null = null;

export function getDurationPatternManager(): DurationPatternManager {
	if (!browser) throw new Error('getDurationPatternManager() is browser-only');
	return instance ??= new DurationPatternManager();
}
