import { browser } from '$app/environment';
import { LayeredPathDetector } from './services/implementations/LayeredPathDetector';

let instance: LayeredPathDetector | null = null;

export function getLayeredPathDetector(): LayeredPathDetector {
	if (!browser) throw new Error('getLayeredPathDetector() is browser-only');
	return instance ??= new LayeredPathDetector();
}
