import { browser } from '$app/environment';
import type { IOptimizedBrowser } from './services/contracts/IOptimizedBrowser';
import { OptimizedBrowser } from './services/implementations/OptimizedBrowser';
import { getDeviceDetector } from '$lib/shared/device/getDeviceDetector';

let instance: IOptimizedBrowser | null = null;

export function getOptimizedBrowser(): IOptimizedBrowser {
	if (!browser) throw new Error('getOptimizedBrowser() is browser-only');
	return instance ??= new OptimizedBrowser(getDeviceDetector());
}
