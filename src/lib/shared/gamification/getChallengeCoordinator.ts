import { browser } from '$app/environment';
import { ChallengeCoordinator } from './services/implementations/ChallengeCoordinator';
import { getDailyChallengeManager } from './getDailyChallengeManager';
import { getWeeklyChallengeManager } from './getWeeklyChallengeManager';
import { getSkillProgressionTracker } from './getSkillProgressionTracker';
import { getAchievementManager } from './getAchievementManager';
import { getStreakTracker } from './getStreakTracker';

let instance: ChallengeCoordinator | null = null;

export function getChallengeCoordinator(): ChallengeCoordinator {
	if (!browser) throw new Error('getChallengeCoordinator() is browser-only');
	return instance ??= new ChallengeCoordinator(
		getDailyChallengeManager(),
		getWeeklyChallengeManager(),
		getSkillProgressionTracker(),
		getAchievementManager(),
		getStreakTracker(),
	);
}
