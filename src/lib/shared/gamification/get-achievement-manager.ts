import { browser } from '$app/environment';

import { AchievementManager } from './services/achievement-manager';

let instance: AchievementManager | null = null;

export function getAchievementManager(): AchievementManager {
	if (!browser) throw new Error('getAchievementManager() is browser-only');
	return instance ??= new AchievementManager();
}
