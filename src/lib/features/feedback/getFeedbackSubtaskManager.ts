import { browser } from '$app/environment';
import type { IFeedbackSubtaskManager } from './services/contracts/IFeedbackSubtaskManager';
import { FeedbackSubtaskManager } from './services/implementations/FeedbackSubtaskManager';

let instance: IFeedbackSubtaskManager | null = null;

export function getFeedbackSubtaskManager(): IFeedbackSubtaskManager {
	if (!browser) throw new Error('getFeedbackSubtaskManager() is browser-only');
	return instance ??= new FeedbackSubtaskManager();
}
