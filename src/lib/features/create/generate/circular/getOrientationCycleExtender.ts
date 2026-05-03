import { browser } from '$app/environment';
import { OrientationCycleExtender } from './services/implementations/OrientationCycleExtender';
import { orientationCalculator } from '$lib/shared/pictograph/prop/services/implementations/OrientationCalculator';
import { getOrientationCycleDetector } from './getOrientationCycleDetector';

let instance: OrientationCycleExtender | null = null;

export function getOrientationCycleExtender(): OrientationCycleExtender {
	if (!browser) throw new Error('getOrientationCycleExtender() is browser-only');
	return instance ??= new OrientationCycleExtender(getOrientationCycleDetector(), orientationCalculator);
}
