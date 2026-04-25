import { browser } from '$app/environment';
import type { ITurnManager } from './services/contracts/ITurnManager';
import { TurnManager } from './services/implementations/TurnManager';

let instance: ITurnManager | null = null;

export function getTurnManager(): ITurnManager {
	if (!browser) throw new Error('getTurnManager() is browser-only');
	return instance ??= new TurnManager();
}
