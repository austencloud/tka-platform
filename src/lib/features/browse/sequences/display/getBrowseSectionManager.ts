import { browser } from '$app/environment';
import { BrowseSectionManager } from './services/implementations/BrowseSectionManager';
import { getWordDeriver } from '$lib/shared/foundation/getWordDeriver';

let instance: BrowseSectionManager | null = null;

export function getBrowseSectionManager(): BrowseSectionManager {
	if (!browser) throw new Error('getBrowseSectionManager() is browser-only');
	return instance ??= new BrowseSectionManager(getWordDeriver());
}
