import { browser } from '$app/environment';

import { PostHogAnalyticsProvider } from './services/PostHogAnalyticsProvider';

let instance: PostHogAnalyticsProvider | null = null;

export function getPostHogAnalyticsProvider(): PostHogAnalyticsProvider {
	if (!browser) throw new Error('getPostHogAnalyticsProvider() is browser-only');
	return instance ??= new PostHogAnalyticsProvider();
}
