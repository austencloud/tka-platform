import { browser } from '$app/environment';
import type { ITriGridCalculator } from './services/contracts/ITriGridCalculator';
import { TriGridCalculator } from './services/implementations/TriGridCalculator';

let instance: ITriGridCalculator | null = null;

export function getTriGridCalculator(): ITriGridCalculator {
	if (!browser) throw new Error('getTriGridCalculator() is browser-only');
	return instance ??= new TriGridCalculator();
}
