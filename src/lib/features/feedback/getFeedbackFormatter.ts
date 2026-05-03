import { browser } from '$app/environment';
import { FeedbackFormatter } from './services/implementations/FeedbackFormatter';

let instance: FeedbackFormatter | null = null;

export function getFeedbackFormatter(): FeedbackFormatter {
	if (!browser) throw new Error('getFeedbackFormatter() is browser-only');
	return instance ??= new FeedbackFormatter();
}
