import { browser } from '$app/environment';
import { OrientationCycleExtender } from './services/orientation-cycle-extender';
import { orientationCalculator } from '$lib/shared/pictograph/prop/services/implementations/OrientationCalculator';
import { getOrientationCycleDetector } from './get-orientation-cycle-detector';

let instance: OrientationCycleExtender | null = null;

export function getOrientationCycleExtender(): OrientationCycleExtender {
	if (!browser) throw new Error('getOrientationCycleExtender() is browser-only');
	return instance ??= new OrientationCycleExtender(getOrientationCycleDetector(), orientationCalculator);
}
