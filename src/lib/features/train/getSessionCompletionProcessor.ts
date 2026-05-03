import { browser } from '$app/environment';

import { SessionCompletionProcessor } from './services/implementations/SessionCompletionProcessor';
import { getPerformanceHistoryTracker } from './getPerformanceHistoryTracker';
import { getAchievementManager } from '$lib/shared/gamification/getAchievementManager';
import { getTrainChallengeManager } from './getTrainChallengeManager';

let instance: SessionCompletionProcessor | null = null;

export function getSessionCompletionProcessor(): SessionCompletionProcessor {
	if (!browser) throw new Error('getSessionCompletionProcessor() is browser-only');
	return instance ??= new SessionCompletionProcessor(
		getPerformanceHistoryTracker(),
		getAchievementManager(),
		getTrainChallengeManager(),
	);
}
