import { browser } from '$app/environment';
import * as feedbackEditor from './services/feedback-editor';

export function getFeedbackEditor() {
	if (!browser) throw new Error('getFeedbackEditor() is browser-only');
	return feedbackEditor;
}
