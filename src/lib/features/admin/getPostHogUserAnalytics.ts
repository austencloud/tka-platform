import { browser } from '$app/environment';

import { PostHogUserAnalytics } from './services/PostHogUserAnalytics';

let instance: PostHogUserAnalytics | null = null;

export function getPostHogUserAnalytics(): PostHogUserAnalytics {
	if (!browser) throw new Error('getPostHogUserAnalytics() is browser-only');
	return instance ??= new PostHogUserAnalytics();
}
