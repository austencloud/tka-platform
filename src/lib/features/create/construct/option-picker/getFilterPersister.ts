import { browser } from '$app/environment';
import { FilterPersister, type IFilterPersister } from './services/FilterPersister';

let instance: IFilterPersister | null = null;

export function getFilterPersister(): IFilterPersister {
	if (!browser) throw new Error('getFilterPersister() is browser-only');
	return instance ??= new FilterPersister();
}
