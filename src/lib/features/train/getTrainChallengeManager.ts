import { browser } from '$app/environment';
import type { ITrainChallengeManager } from './services/contracts/ITrainChallengeManager';
import { TrainChallengeManager } from './services/implementations/TrainChallengeManager';
import { getAchievementManager } from '$lib/shared/gamification/getAchievementManager';

let instance: ITrainChallengeManager | null = null;

export function getTrainChallengeManager(): ITrainChallengeManager {
	if (!browser) throw new Error('getTrainChallengeManager() is browser-only');
	return instance ??= new TrainChallengeManager(getAchievementManager());
}
