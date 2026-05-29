import { browser } from '$app/environment';

import { PictographBlobCache } from './services/pictograph-blob-cache';

let instance: PictographBlobCache | null = null;

export function getPictographBlobCache(): PictographBlobCache {
	if (!browser) throw new Error('getPictographBlobCache() is browser-only');
	return instance ??= new PictographBlobCache();
}
