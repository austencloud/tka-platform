import { browser } from '$app/environment';
import type { ISessionCompletionProcessor } from './services/contracts/ISessionCompletionProcessor';
import { SessionCompletionProcessor } from './services/implementations/SessionCompletionProcessor';
import { getPerformanceHistoryTracker } from './getPerformanceHistoryTracker';
import { getAchievementManager } from '$lib/shared/gamification/getAchievementManager';
import { getTrainChallengeManager } from './getTrainChallengeManager';

let instance: ISessionCompletionProcessor | null = null;

export function getSessionCompletionProcessor(): ISessionCompletionProcessor {
	if (!browser) throw new Error('getSessionCompletionProcessor() is browser-only');
	return instance ??= new SessionCompletionProcessor(
		getPerformanceHistoryTracker(),
		getAchievementManager(),
		getTrainChallengeManager(),
	);
}
