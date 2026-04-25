import { browser } from '$app/environment';
import type { ISpatialTransformDetector } from './services/contracts/ISpatialTransformDetector';
import { SpatialTransformDetector } from './services/implementations/SpatialTransformDetector';

let instance: ISpatialTransformDetector | null = null;

export function getSpatialTransformDetector(): ISpatialTransformDetector {
	if (!browser) throw new Error('getSpatialTransformDetector() is browser-only');
	return instance ??= new SpatialTransformDetector();
}
