import { browser } from '$app/environment';
import { FilterPersister } from '$lib/shared/persistence/services/filter-persister';

let instance: FilterPersister | null = null;

export function getBrowseFilterPersister(): FilterPersister {
	if (!browser) throw new Error('getBrowseFilterPersister() is browser-only');
	return instance ??= new FilterPersister();
}
