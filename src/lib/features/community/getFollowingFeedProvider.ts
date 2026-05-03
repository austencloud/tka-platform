import { browser } from '$app/environment';

import { FollowingFeedProvider } from './services/implementations/FollowingFeedProvider';

let instance: FollowingFeedProvider | null = null;

export function getFollowingFeedProvider(): FollowingFeedProvider {
	if (!browser) throw new Error('getFollowingFeedProvider() is browser-only');
	return instance ??= new FollowingFeedProvider();
}
