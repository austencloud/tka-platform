import { browser } from '$app/environment';
import type { ICameraManager } from './services/contracts/ICameraManager';
import { CameraManager } from './services/implementations/CameraManager';

let instance: ICameraManager | null = null;

export function getCameraManager(): ICameraManager {
	if (!browser) throw new Error('getCameraManager() is browser-only');
	return instance ??= new CameraManager();
}
