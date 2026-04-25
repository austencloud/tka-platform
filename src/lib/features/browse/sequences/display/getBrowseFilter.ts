import { browser } from '$app/environment';
import type { IBrowseFilter } from './services/contracts/IBrowseFilter';
import { BrowseFilter } from './services/implementations/BrowseFilter';

let instance: IBrowseFilter | null = null;

export function getBrowseFilter(): IBrowseFilter {
	if (!browser) throw new Error('getBrowseFilter() is browser-only');
	return instance ??= new BrowseFilter();
}
