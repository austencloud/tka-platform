import { browser } from '$app/environment';
import { GalleryPrefetcher } from './services/gallery-prefetcher';
import { getBrowseLoader } from '$lib/shared/browse/getBrowseLoader';
import { getGalleryOfflineCache } from '$lib/shared/offline/get-gallery-offline-cache';

let instance: GalleryPrefetcher | null = null;

export function getGalleryPrefetcher(): GalleryPrefetcher {
	if (!browser) throw new Error('getGalleryPrefetcher() is browser-only');
	return instance ??= new GalleryPrefetcher(getBrowseLoader(), getGalleryOfflineCache());
}
