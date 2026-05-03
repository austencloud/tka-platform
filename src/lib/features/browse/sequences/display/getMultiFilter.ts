import { browser } from '$app/environment';
import { MultiFilter } from './services/implementations/MultiFilter';
import { BrowseFilter } from './services/implementations/BrowseFilter';

let instance: MultiFilter | null = null;

export function getMultiFilter(): MultiFilter {
	if (!browser) throw new Error('getMultiFilter() is browser-only');
	return instance ??= new MultiFilter(new BrowseFilter());
}
