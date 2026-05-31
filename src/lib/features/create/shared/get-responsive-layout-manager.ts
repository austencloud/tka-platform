import { browser } from '$app/environment';
import { ResponsiveLayoutManager } from '$lib/shared/create/services/responsive-layout-manager';
import { getDeviceDetector } from '$lib/shared/device/get-device-detector';
import { getViewportManager } from '$lib/shared/device/get-viewport-manager';

let instance: ResponsiveLayoutManager | null = null;

export function getResponsiveLayoutManager(): ResponsiveLayoutManager {
	if (!browser) throw new Error('getResponsiveLayoutManager() is browser-only');
	return instance ??= new ResponsiveLayoutManager(getDeviceDetector(), getViewportManager());
}
