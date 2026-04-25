import { browser } from '$app/environment';
import type { IDailyChallengeManager } from './services/contracts/IDailyChallengeManager';
import { DailyChallengeManager } from './services/implementations/DailyChallengeManager';
import { getAchievementManager } from './getAchievementManager';

let instance: IDailyChallengeManager | null = null;

export function getDailyChallengeManager(): IDailyChallengeManager {
	if (!browser) throw new Error('getDailyChallengeManager() is browser-only');
	return instance ??= new DailyChallengeManager(getAchievementManager());
}
