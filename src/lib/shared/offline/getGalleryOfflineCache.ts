import { browser } from '$app/environment';
import type { IGalleryOfflineCache } from './services/contracts/IGalleryOfflineCache';
import { GalleryOfflineCache } from './services/implementations/GalleryOfflineCache';

let instance: IGalleryOfflineCache | null = null;

export function getGalleryOfflineCache(): IGalleryOfflineCache {
	if (!browser) throw new Error('getGalleryOfflineCache() is browser-only');
	return instance ??= new GalleryOfflineCache();
}
