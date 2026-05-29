import { browser } from '$app/environment';

import { PublicSequencesLoader } from '$lib/shared/browse/services/PublicSequencesLoader';
import { getGalleryOfflineCache } from '$lib/shared/offline/get-gallery-offline-cache';

let instance: PublicSequencesLoader | null = null;

export function getBrowseLoader(): PublicSequencesLoader {
	if (!browser) throw new Error('getBrowseLoader() is browser-only');
	return instance ??= new PublicSequencesLoader(getGalleryOfflineCache());
}
