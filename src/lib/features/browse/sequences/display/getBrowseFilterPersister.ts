import { browser } from '$app/environment';
import type { IFilterPersister } from '$lib/shared/persistence/services/contracts/IFilterPersister';
import { FilterPersister } from '$lib/shared/persistence/services/implementations/FilterPersister';

let instance: IFilterPersister | null = null;

export function getBrowseFilterPersister(): IFilterPersister {
	if (!browser) throw new Error('getBrowseFilterPersister() is browser-only');
	return instance ??= new FilterPersister();
}
