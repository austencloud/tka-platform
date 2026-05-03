import { browser } from '$app/environment';

import { FeedbackEditor } from './services/implementations/FeedbackEditor';

let instance: FeedbackEditor | null = null;

export function getFeedbackEditor(): FeedbackEditor {
	if (!browser) throw new Error('getFeedbackEditor() is browser-only');
	return instance ??= new FeedbackEditor();
}
