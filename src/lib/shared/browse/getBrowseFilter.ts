import { browser } from '$app/environment';

import { BrowseFilter } from './services/browse-filter';

let instance: BrowseFilter | null = null;

export function getBrowseFilter(): BrowseFilter {
	if (!browser) throw new Error('getBrowseFilter() is browser-only');
	return instance ??= new BrowseFilter();
}
