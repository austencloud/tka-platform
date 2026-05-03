import { browser } from '$app/environment';
import { ThumbnailLocalCache } from './services/implementations/ThumbnailLocalCache';

let instance: ThumbnailLocalCache | null = null;

export function getThumbnailLocalCache(): ThumbnailLocalCache {
	if (!browser) throw new Error('getThumbnailLocalCache() is browser-only');
	return instance ??= new ThumbnailLocalCache();
}
