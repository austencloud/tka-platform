import { browser } from '$app/environment';
import type { IPostHogUserAnalytics } from './services/contracts/IPostHogUserAnalytics';
import { PostHogUserAnalytics } from './services/implementations/PostHogUserAnalytics';

let instance: IPostHogUserAnalytics | null = null;

export function getPostHogUserAnalytics(): IPostHogUserAnalytics {
	if (!browser) throw new Error('getPostHogUserAnalytics() is browser-only');
	return instance ??= new PostHogUserAnalytics();
}
