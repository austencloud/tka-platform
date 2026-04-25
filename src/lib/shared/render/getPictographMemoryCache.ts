import { browser } from '$app/environment';
import { PictographMemoryCache } from './services/implementations/PictographMemoryCache';

let instance: PictographMemoryCache | null = null;

export function getPictographMemoryCache(): PictographMemoryCache {
	if (!browser) throw new Error('getPictographMemoryCache() is browser-only');
	return instance ??= new PictographMemoryCache();
}
