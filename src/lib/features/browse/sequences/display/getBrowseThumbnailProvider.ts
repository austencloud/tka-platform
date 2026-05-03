import { browser } from '$app/environment';

import { BrowseThumbnailProvider } from './services/implementations/BrowseThumbnailProvider';

let instance: BrowseThumbnailProvider | null = null;

export function getBrowseThumbnailProvider(): BrowseThumbnailProvider {
	if (!browser) throw new Error('getBrowseThumbnailProvider() is browser-only');
	return instance ??= new BrowseThumbnailProvider();
}
