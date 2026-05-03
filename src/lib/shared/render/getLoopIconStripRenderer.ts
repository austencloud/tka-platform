import { browser } from '$app/environment';
import { LOOPIconStripRenderer } from './services/implementations/LOOPIconStripRenderer';

let instance: LOOPIconStripRenderer | null = null;

export function getLoopIconStripRenderer(): LOOPIconStripRenderer {
	if (!browser) throw new Error('getLoopIconStripRenderer() is browser-only');
	return instance ??= new LOOPIconStripRenderer();
}
