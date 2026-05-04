import { browser } from '$app/environment';
import * as feedbackTypeResolver from './services/feedback-type-resolver';

export function getFeedbackTypeResolver() {
	if (!browser) throw new Error('getFeedbackTypeResolver() is browser-only');
	return feedbackTypeResolver;
}
