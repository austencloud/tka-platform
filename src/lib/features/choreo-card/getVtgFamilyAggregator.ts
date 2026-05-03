import { browser } from '$app/environment';

import { VtgFamilyAggregator } from './services/implementations/VtgFamilyAggregator';
import { getDeckLoader } from './getDeckLoader';

let instance: VtgFamilyAggregator | null = null;

export function getVtgFamilyAggregator(): VtgFamilyAggregator {
	if (!browser) throw new Error('getVtgFamilyAggregator() is browser-only');
	return instance ??= new VtgFamilyAggregator(getDeckLoader());
}
