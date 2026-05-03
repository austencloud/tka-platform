import { browser } from '$app/environment';
import { TurnManager } from './services/implementations/TurnManager';

let instance: TurnManager | null = null;

export function getTurnManager(): TurnManager {
	if (!browser) throw new Error('getTurnManager() is browser-only');
	return instance ??= new TurnManager();
}
