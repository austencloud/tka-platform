import { browser } from '$app/environment';
import type { IOrientationAlignmentCalculator } from './services/contracts/IOrientationAlignmentCalculator';
import { OrientationAlignmentCalculator } from './services/implementations/OrientationAlignmentCalculator';

let instance: IOrientationAlignmentCalculator | null = null;

export function getOrientationAlignmentCalculator(): IOrientationAlignmentCalculator {
	if (!browser) throw new Error('getOrientationAlignmentCalculator() is browser-only');
	return instance ??= new OrientationAlignmentCalculator();
}
