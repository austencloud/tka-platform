import { browser } from '$app/environment';
import type { IWeeklyChallengeManager } from './services/contracts/IWeeklyChallengeManager';
import { WeeklyChallengeManager } from './services/implementations/WeeklyChallengeManager';
import { getAchievementManager } from './getAchievementManager';

let instance: IWeeklyChallengeManager | null = null;

export function getWeeklyChallengeManager(): IWeeklyChallengeManager {
	if (!browser) throw new Error('getWeeklyChallengeManager() is browser-only');
	return instance ??= new WeeklyChallengeManager(getAchievementManager());
}
