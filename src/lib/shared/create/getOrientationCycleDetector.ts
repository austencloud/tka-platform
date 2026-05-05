import { browser } from '$app/environment';
import { OrientationCycleDetector } from '$lib/shared/create/services/OrientationCycleDetector';
import { orientationCalculator } from '$lib/shared/pictograph/prop/services/implementations/OrientationCalculator';

let instance: OrientationCycleDetector | null = null;

export function getOrientationCycleDetector(): OrientationCycleDetector {
	if (!browser) throw new Error('getOrientationCycleDetector() is browser-only');
	return instance ??= new OrientationCycleDetector(orientationCalculator);
}
