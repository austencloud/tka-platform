import { browser } from '$app/environment';
import { BrowseSectionManager } from '$lib/shared/browse/services/BrowseSectionManager';

let instance: BrowseSectionManager | null = null;

export function getBrowseSectionManager(): BrowseSectionManager {
	if (!browser) throw new Error('getBrowseSectionManager() is browser-only');
	return instance ??= new BrowseSectionManager();
}
