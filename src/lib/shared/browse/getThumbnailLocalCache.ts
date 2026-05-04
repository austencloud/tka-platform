import { browser } from '$app/environment';
import { ThumbnailLocalCache } from '$lib/shared/browse/services/ThumbnailLocalCache';

let instance: ThumbnailLocalCache | null = null;

export function getThumbnailLocalCache(): ThumbnailLocalCache {
	if (!browser) throw new Error('getThumbnailLocalCache() is browser-only');
	return instance ??= new ThumbnailLocalCache();
}
