import { browser } from '$app/environment';
import * as triGridCalculator from './services/trigrid-calculator';

export function getTriGridCalculator(): typeof triGridCalculator {
	if (!browser) throw new Error('getTriGridCalculator() is browser-only');
	return triGridCalculator;
}
