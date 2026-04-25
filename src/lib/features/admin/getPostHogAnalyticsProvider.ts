import { browser } from '$app/environment';
import type { IPostHogAnalyticsProvider } from './services/contracts/IPostHogAnalyticsProvider';
import { PostHogAnalyticsProvider } from './services/implementations/PostHogAnalyticsProvider';

let instance: IPostHogAnalyticsProvider | null = null;

export function getPostHogAnalyticsProvider(): IPostHogAnalyticsProvider {
	if (!browser) throw new Error('getPostHogAnalyticsProvider() is browser-only');
	return instance ??= new PostHogAnalyticsProvider();
}
