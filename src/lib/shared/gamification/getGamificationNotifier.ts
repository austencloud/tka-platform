import { browser } from '$app/environment';
import { GamificationNotifier } from './services/implementations/GamificationNotifier';

let instance: GamificationNotifier | null = null;

export function getGamificationNotifier(): GamificationNotifier {
	if (!browser) throw new Error('getGamificationNotifier() is browser-only');
	return instance ??= new GamificationNotifier();
}
