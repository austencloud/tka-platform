import { browser } from '$app/environment';
import { BrowseSectionManager } from '$lib/features/browse/sequences/display/services/implementations/BrowseSectionManager';

let instance: BrowseSectionManager | null = null;

export function getBrowseSectionManager(): BrowseSectionManager {
	if (!browser) throw new Error('getBrowseSectionManager() is browser-only');
	return instance ??= new BrowseSectionManager();
}
