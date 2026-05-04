import { browser } from '$app/environment';
import { CreateModuleLayoutManager } from './services/CreateModuleLayoutManager';
import { getDeviceDetector } from '$lib/shared/device/getDeviceDetector';
import { getViewportManager } from '$lib/shared/device/getViewportManager';

let instance: CreateModuleLayoutManager | null = null;

export function getCreateModuleLayoutManager(): CreateModuleLayoutManager {
	if (!browser) throw new Error('getCreateModuleLayoutManager() is browser-only');
	return instance ??= new CreateModuleLayoutManager(getDeviceDetector(), getViewportManager());
}
