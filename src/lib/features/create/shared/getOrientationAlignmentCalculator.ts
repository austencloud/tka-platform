import { browser } from '$app/environment';
import { OrientationAlignmentCalculator } from './services/implementations/OrientationAlignmentCalculator';

let instance: OrientationAlignmentCalculator | null = null;

export function getOrientationAlignmentCalculator(): OrientationAlignmentCalculator {
	if (!browser) throw new Error('getOrientationAlignmentCalculator() is browser-only');
	return instance ??= new OrientationAlignmentCalculator();
}
