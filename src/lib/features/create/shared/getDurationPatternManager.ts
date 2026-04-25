import { browser } from '$app/environment';
import type { IDurationPatternManager } from './services/contracts/IDurationPatternManager';
import { DurationPatternManager } from './services/implementations/DurationPatternManager';

let instance: IDurationPatternManager | null = null;

export function getDurationPatternManager(): IDurationPatternManager {
	if (!browser) throw new Error('getDurationPatternManager() is browser-only');
	return instance ??= new DurationPatternManager();
}
