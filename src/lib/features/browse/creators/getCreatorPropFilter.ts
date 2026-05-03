import { browser } from '$app/environment';
import { CreatorPropFilter } from './services/implementations/CreatorPropFilter';

let instance: CreatorPropFilter | null = null;

export function getCreatorPropFilter(): CreatorPropFilter {
	if (!browser) throw new Error('getCreatorPropFilter() is browser-only');
	return instance ??= new CreatorPropFilter();
}
