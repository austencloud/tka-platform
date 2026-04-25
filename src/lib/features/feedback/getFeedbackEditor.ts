import { browser } from '$app/environment';
import type { IFeedbackEditor } from './services/contracts/IFeedbackEditor';
import { FeedbackEditor } from './services/implementations/FeedbackEditor';

let instance: IFeedbackEditor | null = null;

export function getFeedbackEditor(): IFeedbackEditor {
	if (!browser) throw new Error('getFeedbackEditor() is browser-only');
	return instance ??= new FeedbackEditor();
}
