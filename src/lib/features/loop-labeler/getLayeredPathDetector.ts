import { browser } from '$app/environment';
import type { ILayeredPathDetector } from './services/contracts/ILayeredPathDetector';
import { LayeredPathDetector } from './services/implementations/LayeredPathDetector';

let instance: ILayeredPathDetector | null = null;

export function getLayeredPathDetector(): ILayeredPathDetector {
	if (!browser) throw new Error('getLayeredPathDetector() is browser-only');
	return instance ??= new LayeredPathDetector();
}
