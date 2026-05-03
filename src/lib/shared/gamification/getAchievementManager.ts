import { browser } from '$app/environment';

import { AchievementManager } from './services/implementations/AchievementManager';
import { getGamificationNotifier } from './getGamificationNotifier';

let instance: AchievementManager | null = null;

export function getAchievementManager(): AchievementManager {
	if (!browser) throw new Error('getAchievementManager() is browser-only');
	return instance ??= new AchievementManager(getGamificationNotifier());
}
