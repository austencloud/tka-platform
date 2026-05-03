import { browser } from '$app/environment';

import { FeedbackTypeResolver } from './services/implementations/FeedbackTypeResolver';

let instance: FeedbackTypeResolver | null = null;

export function getFeedbackTypeResolver(): FeedbackTypeResolver {
	if (!browser) throw new Error('getFeedbackTypeResolver() is browser-only');
	return instance ??= new FeedbackTypeResolver();
}
