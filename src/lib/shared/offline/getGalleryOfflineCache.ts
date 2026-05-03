import { browser } from '$app/environment';

import { GalleryOfflineCache } from './services/implementations/GalleryOfflineCache';

let instance: GalleryOfflineCache | null = null;

export function getGalleryOfflineCache(): GalleryOfflineCache {
	if (!browser) throw new Error('getGalleryOfflineCache() is browser-only');
	return instance ??= new GalleryOfflineCache();
}
