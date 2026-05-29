import { browser } from '$app/environment';

import { OptimizedBrowser } from './services/optimized-browser';
import { getDeviceDetector } from '$lib/shared/device/getDeviceDetector';

let instance: OptimizedBrowser | null = null;

export function getOptimizedBrowser(): OptimizedBrowser {
	if (!browser) throw new Error('getOptimizedBrowser() is browser-only');
	return instance ??= new OptimizedBrowser(getDeviceDetector());
}
