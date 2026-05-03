import { browser } from '$app/environment';

import { DimensionCalculator } from './services/implementations/DimensionCalculator';

let instance: DimensionCalculator | null = null;

export function getDimensionCalculator(): DimensionCalculator {
	if (!browser) throw new Error('getDimensionCalculator() is browser-only');
	return instance ??= new DimensionCalculator();
}
