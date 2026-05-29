import { browser } from '$app/environment';
import { MultiFilter } from './services/multi-filter';
import { BrowseFilter } from './services/browse-filter';

let instance: MultiFilter | null = null;

export function getMultiFilter(): MultiFilter {
	if (!browser) throw new Error('getMultiFilter() is browser-only');
	return instance ??= new MultiFilter(new BrowseFilter());
}
