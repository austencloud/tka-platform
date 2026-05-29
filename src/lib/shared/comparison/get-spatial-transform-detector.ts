import { browser } from '$app/environment';
import { SpatialTransformDetector } from './services/spatial-transform-detector';

let instance: SpatialTransformDetector | null = null;

export function getSpatialTransformDetector(): SpatialTransformDetector {
	if (!browser) throw new Error('getSpatialTransformDetector() is browser-only');
	return instance ??= new SpatialTransformDetector();
}
