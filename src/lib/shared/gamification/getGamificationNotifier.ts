import { browser } from '$app/environment';
import type { IGamificationNotifier } from './services/contracts/IGamificationNotifier';
import { GamificationNotifier } from './services/implementations/GamificationNotifier';

let instance: IGamificationNotifier | null = null;

export function getGamificationNotifier(): IGamificationNotifier {
	if (!browser) throw new Error('getGamificationNotifier() is browser-only');
	return instance ??= new GamificationNotifier();
}
