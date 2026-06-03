import { browser } from '$app/environment';
import { CreateModuleLayoutManager } from './services/create-module-layout-manager';
import { getDeviceDetector } from '$lib/shared/device/get-device-detector';
import { getViewportManager } from '$lib/shared/device/get-viewport-manager';

let instance: CreateModuleLayoutManager | null = null;

export function getCreateModuleLayoutManager(): CreateModuleLayoutManager {
	if (!browser) throw new Error('getCreateModuleLayoutManager() is browser-only');
	return instance ??= new CreateModuleLayoutManager(getDeviceDetector(), getViewportManager());
}
