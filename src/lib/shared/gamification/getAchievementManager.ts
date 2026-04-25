import { browser } from '$app/environment';
import type { IAchievementManager } from './services/contracts/IAchievementManager';
import { AchievementManager } from './services/implementations/AchievementManager';
import { getGamificationNotifier } from './getGamificationNotifier';

let instance: IAchievementManager | null = null;

export function getAchievementManager(): IAchievementManager {
	if (!browser) throw new Error('getAchievementManager() is browser-only');
	return instance ??= new AchievementManager(getGamificationNotifier());
}
