import { browser } from '$app/environment';
import type { IThumbnailLocalCache } from './services/contracts/IThumbnailLocalCache';
import { ThumbnailLocalCache } from './services/implementations/ThumbnailLocalCache';

let instance: IThumbnailLocalCache | null = null;

export function getThumbnailLocalCache(): IThumbnailLocalCache {
	if (!browser) throw new Error('getThumbnailLocalCache() is browser-only');
	return instance ??= new ThumbnailLocalCache();
}
