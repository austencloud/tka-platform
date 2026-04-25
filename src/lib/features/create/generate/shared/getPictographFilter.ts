import { browser } from '$app/environment';
import type { IPictographFilter } from './services/contracts/IPictographFilter';
import { PictographFilter } from './services/implementations/PictographFilter';

let instance: IPictographFilter | null = null;

export function getPictographFilter(): IPictographFilter {
	if (!browser) throw new Error('getPictographFilter() is browser-only');
	return instance ??= new PictographFilter();
}
