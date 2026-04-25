import { browser } from '$app/environment';
import type { IBrowseThumbnailProvider } from './services/contracts/IBrowseThumbnailProvider';
import { BrowseThumbnailProvider } from './services/implementations/BrowseThumbnailProvider';

let instance: IBrowseThumbnailProvider | null = null;

export function getBrowseThumbnailProvider(): IBrowseThumbnailProvider {
	if (!browser) throw new Error('getBrowseThumbnailProvider() is browser-only');
	return instance ??= new BrowseThumbnailProvider();
}
