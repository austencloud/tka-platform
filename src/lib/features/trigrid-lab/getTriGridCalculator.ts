import { browser } from '$app/environment';
import { TriGridCalculator } from './services/implementations/TriGridCalculator';

let instance: TriGridCalculator | null = null;

export function getTriGridCalculator(): TriGridCalculator {
	if (!browser) throw new Error('getTriGridCalculator() is browser-only');
	return instance ??= new TriGridCalculator();
}
