import { browser } from '$app/environment';

import { VariationGrouper } from '$lib/features/browse/sequences/display/services/implementations/VariationGrouper';

let instance: VariationGrouper | null = null;

export function getVariationGrouper(): VariationGrouper {
	if (!browser) throw new Error('getVariationGrouper() is browser-only');
	return instance ??= new VariationGrouper();
}
