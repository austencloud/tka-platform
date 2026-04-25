import { browser } from '$app/environment';
import type { ILOOPIconStripRenderer } from './services/contracts/ILOOPIconStripRenderer';
import { LOOPIconStripRenderer } from './services/implementations/LOOPIconStripRenderer';

let instance: ILOOPIconStripRenderer | null = null;

export function getLoopIconStripRenderer(): ILOOPIconStripRenderer {
	if (!browser) throw new Error('getLoopIconStripRenderer() is browser-only');
	return instance ??= new LOOPIconStripRenderer();
}
