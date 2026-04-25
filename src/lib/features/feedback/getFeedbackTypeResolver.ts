import { browser } from '$app/environment';
import type { IFeedbackTypeResolver } from './services/contracts/IFeedbackTypeResolver';
import { FeedbackTypeResolver } from './services/implementations/FeedbackTypeResolver';

let instance: IFeedbackTypeResolver | null = null;

export function getFeedbackTypeResolver(): IFeedbackTypeResolver {
	if (!browser) throw new Error('getFeedbackTypeResolver() is browser-only');
	return instance ??= new FeedbackTypeResolver();
}
