import { browser } from '$app/environment';
import type { IBrowseCache } from './services/contracts/IBrowseCache';
import { BrowseCache } from './services/implementations/BrowseCache';

let instance: IBrowseCache | null = null;

export function getBrowseCache(): IBrowseCache {
	if (!browser) throw new Error('getBrowseCache() is browser-only');
	return instance ??= new BrowseCache();
}
