import { browser } from '$app/environment';
import { PictographFilter } from './services/implementations/PictographFilter';

let instance: PictographFilter | null = null;

export function getPictographFilter(): PictographFilter {
	if (!browser) throw new Error('getPictographFilter() is browser-only');
	return instance ??= new PictographFilter();
}
