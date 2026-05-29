import { browser } from '$app/environment';
import { ResponsiveLayoutManager } from '$lib/shared/create/services/ResponsiveLayoutManager';
import { getDeviceDetector } from '$lib/shared/device/getDeviceDetector';
import { getViewportManager } from '$lib/shared/device/getViewportManager';

let instance: ResponsiveLayoutManager | null = null;

export function getResponsiveLayoutManager(): ResponsiveLayoutManager {
	if (!browser) throw new Error('getResponsiveLayoutManager() is browser-only');
	return instance ??= new ResponsiveLayoutManager(getDeviceDetector(), getViewportManager());
}
