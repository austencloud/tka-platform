import { browser } from '$app/environment';

import { SessionCompletionProcessor } from './services/session-completion-processor';
import { getPerformanceHistoryTracker } from './get-performance-history-tracker';
import { getAchievementManager } from '$lib/shared/gamification/get-achievement-manager';
import { getTrainChallengeManager } from './get-train-challenge-manager';

let instance: SessionCompletionProcessor | null = null;

export function getSessionCompletionProcessor(): SessionCompletionProcessor {
	if (!browser) throw new Error('getSessionCompletionProcessor() is browser-only');
	return instance ??= new SessionCompletionProcessor(
		getPerformanceHistoryTracker(),
		getAchievementManager(),
		getTrainChallengeManager(),
	);
}
