import { browser } from '$app/environment';
import type { IGalleryPrefetcher } from './services/contracts/IGalleryPrefetcher';
import { GalleryPrefetcher } from './services/implementations/GalleryPrefetcher';
import { getBrowseLoader } from '../sequences/display/getBrowseLoader';
import { getGalleryOfflineCache } from '$lib/shared/offline/getGalleryOfflineCache';

let instance: IGalleryPrefetcher | null = null;

export function getGalleryPrefetcher(): IGalleryPrefetcher {
	if (!browser) throw new Error('getGalleryPrefetcher() is browser-only');
	return instance ??= new GalleryPrefetcher(getBrowseLoader(), getGalleryOfflineCache());
}
