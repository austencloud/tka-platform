import { browser } from '$app/environment';
import type { IOrientationCycleDetector } from './services/contracts/IOrientationCycleDetector';
import { OrientationCycleDetector } from './services/implementations/OrientationCycleDetector';
import { orientationCalculator } from '$lib/shared/pictograph/prop/services/implementations/OrientationCalculator';

let instance: IOrientationCycleDetector | null = null;

export function getOrientationCycleDetector(): IOrientationCycleDetector {
	if (!browser) throw new Error('getOrientationCycleDetector() is browser-only');
	return instance ??= new OrientationCycleDetector(orientationCalculator);
}
