import { browser } from '$app/environment';

import { PostHogAnalyticsProvider } from './services/implementations/PostHogAnalyticsProvider';

let instance: PostHogAnalyticsProvider | null = null;

export function getPostHogAnalyticsProvider(): PostHogAnalyticsProvider {
	if (!browser) throw new Error('getPostHogAnalyticsProvider() is browser-only');
	return instance ??= new PostHogAnalyticsProvider();
}
