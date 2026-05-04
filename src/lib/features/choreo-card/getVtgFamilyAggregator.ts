import { browser } from '$app/environment';

import { VtgFamilyAggregator } from './services/implementations/VtgFamilyAggregator';

let instance: VtgFamilyAggregator | null = null;

export function getVtgFamilyAggregator(): VtgFamilyAggregator {
	if (!browser) throw new Error('getVtgFamilyAggregator() is browser-only');
	return instance ??= new VtgFamilyAggregator();
}
