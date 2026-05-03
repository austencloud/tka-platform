import { browser } from '$app/environment';

import { TurnPatternManager } from './services/implementations/TurnPatternManager';

let instance: TurnPatternManager | null = null;

export function getTurnPatternManager(): TurnPatternManager {
	if (!browser) throw new Error('getTurnPatternManager() is browser-only');
	return instance ??= new TurnPatternManager();
}
