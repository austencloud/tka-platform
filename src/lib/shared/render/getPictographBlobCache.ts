import { browser } from '$app/environment';
import type { IPictographBlobCache } from './services/contracts/IPictographBlobCache';
import { PictographBlobCache } from './services/implementations/PictographBlobCache';

let instance: IPictographBlobCache | null = null;

export function getPictographBlobCache(): IPictographBlobCache {
	if (!browser) throw new Error('getPictographBlobCache() is browser-only');
	return instance ??= new PictographBlobCache();
}
