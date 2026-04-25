import { browser } from '$app/environment';
import type { IBrowseSectionManager } from './services/contracts/IBrowseSectionManager';
import { BrowseSectionManager } from './services/implementations/BrowseSectionManager';
import { getWordDeriver } from '$lib/shared/foundation/getWordDeriver';

let instance: IBrowseSectionManager | null = null;

export function getBrowseSectionManager(): IBrowseSectionManager {
	if (!browser) throw new Error('getBrowseSectionManager() is browser-only');
	return instance ??= new BrowseSectionManager(getWordDeriver());
}
