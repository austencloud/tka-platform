import { browser } from '$app/environment';
import { ChallengeCoordinator } from './services/challenge-coordinator';
import { getDailyChallengeManager } from './get-daily-challenge-manager';
import { getWeeklyChallengeManager } from './get-weekly-challenge-manager';
import { getSkillProgressionTracker } from './get-skill-progression-tracker';
import { getAchievementManager } from './get-achievement-manager';
import { getStreakTracker } from './get-streak-tracker';

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
