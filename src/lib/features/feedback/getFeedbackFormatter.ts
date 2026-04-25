import { browser } from '$app/environment';
import type { IFeedbackFormatter } from './services/contracts/IFeedbackFormatter';
import { FeedbackFormatter } from './services/implementations/FeedbackFormatter';

let instance: IFeedbackFormatter | null = null;

export function getFeedbackFormatter(): IFeedbackFormatter {
	if (!browser) throw new Error('getFeedbackFormatter() is browser-only');
	return instance ??= new FeedbackFormatter();
}
