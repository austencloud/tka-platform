import { browser } from '$app/environment';
import type { IChallengeCoordinator } from './services/contracts/IChallengeCoordinator';
import { ChallengeCoordinator } from './services/implementations/ChallengeCoordinator';
import { getDailyChallengeManager } from './getDailyChallengeManager';
import { getWeeklyChallengeManager } from './getWeeklyChallengeManager';
import { getSkillProgressionTracker } from './getSkillProgressionTracker';
import { getAchievementManager } from './getAchievementManager';
import { getStreakTracker } from './getStreakTracker';

let instance: IChallengeCoordinator | null = null;

export function getChallengeCoordinator(): IChallengeCoordinator {
	if (!browser) throw new Error('getChallengeCoordinator() is browser-only');
	return instance ??= new ChallengeCoordinator(
		getDailyChallengeManager(),
		getWeeklyChallengeManager(),
		getSkillProgressionTracker(),
		getAchievementManager(),
		getStreakTracker(),
	);
}
