import { browser } from '$app/environment';
import type { IVtgFamilyAggregator } from './services/contracts/IVtgFamilyAggregator';
import { VtgFamilyAggregator } from './services/implementations/VtgFamilyAggregator';
import { getDeckLoader } from './getDeckLoader';

let instance: IVtgFamilyAggregator | null = null;

export function getVtgFamilyAggregator(): IVtgFamilyAggregator {
	if (!browser) throw new Error('getVtgFamilyAggregator() is browser-only');
	return instance ??= new VtgFamilyAggregator(getDeckLoader());
}
