import { browser } from '$app/environment';

import { LayoutDetector } from './services/layout-detector';
import { getDeviceDetector } from '$lib/shared/device/get-device-detector';

let instance: LayoutDetector | null = null;

export function getLayoutDetector(): LayoutDetector {
	if (!browser) throw new Error('getLayoutDetector() is browser-only');
	return instance ??= new LayoutDetector(getDeviceDetector());
}
