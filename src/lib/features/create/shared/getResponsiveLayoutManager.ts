import { browser } from '$app/environment';
import type { IResponsiveLayoutManager } from './services/contracts/IResponsiveLayoutManager';
import { ResponsiveLayoutManager } from './services/implementations/ResponsiveLayoutManager';
import { getDeviceDetector } from '$lib/shared/device/getDeviceDetector';
import { getViewportManager } from '$lib/shared/device/getViewportManager';

let instance: IResponsiveLayoutManager | null = null;

export function getResponsiveLayoutManager(): IResponsiveLayoutManager {
	if (!browser) throw new Error('getResponsiveLayoutManager() is browser-only');
	return instance ??= new ResponsiveLayoutManager(getDeviceDetector(), getViewportManager());
}
