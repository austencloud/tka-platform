import { browser } from '$app/environment';
import type { IVariationGrouper } from './services/contracts/IVariationGrouper';
import { VariationGrouper } from './services/implementations/VariationGrouper';

let instance: IVariationGrouper | null = null;

export function getVariationGrouper(): IVariationGrouper {
	if (!browser) throw new Error('getVariationGrouper() is browser-only');
	return instance ??= new VariationGrouper();
}
