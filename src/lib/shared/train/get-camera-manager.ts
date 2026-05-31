import { browser } from '$app/environment';
import { CameraManager } from '$lib/shared/train/services/camera-manager';

let instance: CameraManager | null = null;

export function getCameraManager(): CameraManager {
	if (!browser) throw new Error('getCameraManager() is browser-only');
	return instance ??= new CameraManager();
}
