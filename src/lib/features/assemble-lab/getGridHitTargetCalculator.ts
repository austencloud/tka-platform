import { browser } from '$app/environment';
import type { IGridHitTargetCalculator } from './services/contracts/IGridHitTargetCalculator';
import { GridHitTargetCalculator } from './services/implementations/GridHitTargetCalculator';

let instance: IGridHitTargetCalculator | null = null;

export function getGridHitTargetCalculator(): IGridHitTargetCalculator {
	if (!browser) throw new Error('getGridHitTargetCalculator() is browser-only');
	return instance ??= new GridHitTargetCalculator();
}
