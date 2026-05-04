import { browser } from '$app/environment';

import { PublicSequencesLoader } from '$lib/features/browse/sequences/display/services/implementations/PublicSequencesLoader';
import { getGalleryOfflineCache } from '$lib/shared/offline/getGalleryOfflineCache';

let instance: PublicSequencesLoader | null = null;

export function getBrowseLoader(): PublicSequencesLoader {
	if (!browser) throw new Error('getBrowseLoader() is browser-only');
	return instance ??= new PublicSequencesLoader(getGalleryOfflineCache());
}
