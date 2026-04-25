import { browser } from '$app/environment';
import { GlyphCache, type IGlyphCache } from './services/implementations/GlyphCache';

let instance: IGlyphCache | null = null;

export function getGlyphCache(): IGlyphCache {
	if (!browser) throw new Error('getGlyphCache() is browser-only');
	return instance ??= new GlyphCache();
}
