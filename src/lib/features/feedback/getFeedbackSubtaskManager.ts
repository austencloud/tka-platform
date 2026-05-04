import { browser } from '$app/environment';
import * as feedbackSubtaskManager from './services/feedback-subtask-manager';

export function getFeedbackSubtaskManager() {
	if (!browser) throw new Error('getFeedbackSubtaskManager() is browser-only');
	return feedbackSubtaskManager;
}
