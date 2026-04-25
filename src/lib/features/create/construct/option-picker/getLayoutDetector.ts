import { browser } from '$app/environment';
import type { ILayoutDetector } from './services/contracts/ILayoutDetector';
import { LayoutDetector } from './services/implementations/LayoutDetector';
import { getDeviceDetector } from '$lib/shared/device/getDeviceDetector';

let instance: ILayoutDetector | null = null;

export function getLayoutDetector(): ILayoutDetector {
	if (!browser) throw new Error('getLayoutDetector() is browser-only');
	return instance ??= new LayoutDetector(getDeviceDetector());
}
