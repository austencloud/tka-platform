import { browser } from '$app/environment';
import type { IBrowseLoader } from './services/contracts/IBrowseLoader';
import { PublicSequencesLoader } from './services/implementations/PublicSequencesLoader';
import { getGalleryOfflineCache } from '$lib/shared/offline/getGalleryOfflineCache';

let instance: IBrowseLoader | null = null;

export function getBrowseLoader(): IBrowseLoader {
	if (!browser) throw new Error('getBrowseLoader() is browser-only');
	return instance ??= new PublicSequencesLoader(getGalleryOfflineCache());
}
