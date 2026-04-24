import { browser } from '$app/environment';
import type { IMobileFullscreenManager } from './services/contracts/IMobileFullscreenManager';
import { MobileFullscreenManager } from './services/implementations/MobileFullscreenManager';

let instance: IMobileFullscreenManager | null = null;

export function getMobileFullscreenManager(): IMobileFullscreenManager {
	if (!browser) throw new Error('getMobileFullscreenManager() is browser-only');
	return instance ??= new MobileFullscreenManager();
}
