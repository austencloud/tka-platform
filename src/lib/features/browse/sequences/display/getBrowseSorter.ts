import { browser } from '$app/environment';

import { BrowseSorter } from './services/implementations/BrowseSorter';

let instance: BrowseSorter | null = null;

export function getBrowseSorter(): BrowseSorter {
	if (!browser) throw new Error('getBrowseSorter() is browser-only');
	return instance ??= new BrowseSorter();
}
