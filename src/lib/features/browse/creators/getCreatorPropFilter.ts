import { browser } from '$app/environment';
import type { ICreatorPropFilter } from './services/contracts/ICreatorPropFilter';
import { CreatorPropFilter } from './services/implementations/CreatorPropFilter';

let instance: ICreatorPropFilter | null = null;

export function getCreatorPropFilter(): ICreatorPropFilter {
	if (!browser) throw new Error('getCreatorPropFilter() is browser-only');
	return instance ??= new CreatorPropFilter();
}
