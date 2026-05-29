import { browser } from '$app/environment';
import { WeeklyChallengeManager } from './services/weekly-challenge-manager';
import { getAchievementManager } from './get-achievement-manager';

let instance: WeeklyChallengeManager | null = null;

export function getWeeklyChallengeManager(): WeeklyChallengeManager {
	if (!browser) throw new Error('getWeeklyChallengeManager() is browser-only');
	return instance ??= new WeeklyChallengeManager(getAchievementManager());
}
