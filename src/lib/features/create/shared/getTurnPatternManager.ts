import { browser } from '$app/environment';
import type { ITurnPatternManager } from './services/contracts/ITurnPatternManager';
import { TurnPatternManager } from './services/implementations/TurnPatternManager';

let instance: ITurnPatternManager | null = null;

export function getTurnPatternManager(): ITurnPatternManager {
	if (!browser) throw new Error('getTurnPatternManager() is browser-only');
	return instance ??= new TurnPatternManager();
}
