import { browser } from '$app/environment';
import { GlyphCache } from './services/implementations/GlyphCache';

let instance: GlyphCache | null = null;

export function getGlyphCache(): GlyphCache {
	if (!browser) throw new Error('getGlyphCache() is browser-only');
	return instance ??= new GlyphCache();
}
