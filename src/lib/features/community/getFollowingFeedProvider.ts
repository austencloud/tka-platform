import { browser } from '$app/environment';
import type { IFollowingFeedProvider } from './services/contracts/IFollowingFeedProvider';
import { FollowingFeedProvider } from './services/implementations/FollowingFeedProvider';

let instance: IFollowingFeedProvider | null = null;

export function getFollowingFeedProvider(): IFollowingFeedProvider {
	if (!browser) throw new Error('getFollowingFeedProvider() is browser-only');
	return instance ??= new FollowingFeedProvider();
}
