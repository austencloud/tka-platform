import { browser } from '$app/environment';
import { FeedbackSubtaskManager } from './services/implementations/FeedbackSubtaskManager';

let instance: FeedbackSubtaskManager | null = null;

export function getFeedbackSubtaskManager(): FeedbackSubtaskManager {
	if (!browser) throw new Error('getFeedbackSubtaskManager() is browser-only');
	return instance ??= new FeedbackSubtaskManager();
}
