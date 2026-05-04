import { browser } from '$app/environment';

import { BrowseFilter } from '$lib/features/browse/sequences/display/services/implementations/BrowseFilter';

let instance: BrowseFilter | null = null;

export function getBrowseFilter(): BrowseFilter {
	if (!browser) throw new Error('getBrowseFilter() is browser-only');
	return instance ??= new BrowseFilter();
}
