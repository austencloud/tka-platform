import { browser } from '$app/environment';
import type { IDimensionCalculator } from './services/contracts/IDimensionCalculator';
import { DimensionCalculator } from './services/implementations/DimensionCalculator';

let instance: IDimensionCalculator | null = null;

export function getDimensionCalculator(): IDimensionCalculator {
	if (!browser) throw new Error('getDimensionCalculator() is browser-only');
	return instance ??= new DimensionCalculator();
}
