import { browser } from '$app/environment';
import type { IMultiFilter } from './services/contracts/IMultiFilter';
import { MultiFilter } from './services/implementations/MultiFilter';
import { BrowseFilter } from './services/implementations/BrowseFilter';

let instance: IMultiFilter | null = null;

export function getMultiFilter(): IMultiFilter {
	if (!browser) throw new Error('getMultiFilter() is browser-only');
	return instance ??= new MultiFilter(new BrowseFilter());
}
