import { browser } from '$app/environment';
import type { IOrientationCycleExtender } from './services/contracts/IOrientationCycleExtender';
import { OrientationCycleExtender } from './services/implementations/OrientationCycleExtender';
import { orientationCalculator } from '$lib/shared/pictograph/prop/services/implementations/OrientationCalculator';
import { getOrientationCycleDetector } from './getOrientationCycleDetector';

let instance: IOrientationCycleExtender | null = null;

export function getOrientationCycleExtender(): IOrientationCycleExtender {
	if (!browser) throw new Error('getOrientationCycleExtender() is browser-only');
	return instance ??= new OrientationCycleExtender(getOrientationCycleDetector(), orientationCalculator);
}
