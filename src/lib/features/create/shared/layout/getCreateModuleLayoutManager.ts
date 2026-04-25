import { browser } from '$app/environment';
import type { ICreateModuleLayoutManager } from './services/ICreateModuleLayoutManager';
import { CreateModuleLayoutManager } from './services/CreateModuleLayoutManager';
import { getDeviceDetector } from '$lib/shared/device/getDeviceDetector';
import { getViewportManager } from '$lib/shared/device/getViewportManager';

let instance: ICreateModuleLayoutManager | null = null;

export function getCreateModuleLayoutManager(): ICreateModuleLayoutManager {
	if (!browser) throw new Error('getCreateModuleLayoutManager() is browser-only');
	return instance ??= new CreateModuleLayoutManager(getDeviceDetector(), getViewportManager());
}
