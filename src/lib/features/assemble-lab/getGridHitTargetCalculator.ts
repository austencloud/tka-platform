import { browser } from '$app/environment';

import { GridHitTargetCalculator } from './services/implementations/GridHitTargetCalculator';

let instance: GridHitTargetCalculator | null = null;

export function getGridHitTargetCalculator(): GridHitTargetCalculator {
	if (!browser) throw new Error('getGridHitTargetCalculator() is browser-only');
	return instance ??= new GridHitTargetCalculator();
}
