import { browser } from '$app/environment';
import { DailyChallengeManager } from './services/implementations/DailyChallengeManager';
import { getAchievementManager } from './getAchievementManager';

let instance: DailyChallengeManager | null = null;

export function getDailyChallengeManager(): DailyChallengeManager {
	if (!browser) throw new Error('getDailyChallengeManager() is browser-only');
	return instance ??= new DailyChallengeManager(getAchievementManager());
}
