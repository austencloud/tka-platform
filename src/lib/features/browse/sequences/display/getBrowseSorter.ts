import { browser } from '$app/environment';
import type { IBrowseSorter } from './services/contracts/IBrowseSorter';
import { BrowseSorter } from './services/implementations/BrowseSorter';

let instance: IBrowseSorter | null = null;

export function getBrowseSorter(): IBrowseSorter {
	if (!browser) throw new Error('getBrowseSorter() is browser-only');
	return instance ??= new BrowseSorter();
}
