import { browser } from '$app/environment';
import { WeeklyChallengeManager } from './services/implementations/WeeklyChallengeManager';
import { getAchievementManager } from './getAchievementManager';

let instance: WeeklyChallengeManager | null = null;

export function getWeeklyChallengeManager(): WeeklyChallengeManager {
	if (!browser) throw new Error('getWeeklyChallengeManager() is browser-only');
	return instance ??= new WeeklyChallengeManager(getAchievementManager());
}
