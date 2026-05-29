import { browser } from '$app/environment';
import { TrainChallengeManager } from './services/train-challenge-manager';
import { getAchievementManager } from '$lib/shared/gamification/getAchievementManager';

let instance: TrainChallengeManager | null = null;

export function getTrainChallengeManager(): TrainChallengeManager {
	if (!browser) throw new Error('getTrainChallengeManager() is browser-only');
	return instance ??= new TrainChallengeManager(getAchievementManager());
}
