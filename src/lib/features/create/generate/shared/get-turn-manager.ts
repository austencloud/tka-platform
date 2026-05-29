import { browser } from '$app/environment';
import { turnManager } from './services/turn-manager';

export function getTurnManager(): typeof turnManager {
	if (!browser) throw new Error('getTurnManager() is browser-only');
	return turnManager;
}
