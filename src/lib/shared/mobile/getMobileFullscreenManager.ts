import { browser } from '$app/environment';

import { MobileFullscreenManager } from './services/implementations/MobileFullscreenManager';

let instance: MobileFullscreenManager | null = null;

export function getMobileFullscreenManager(): MobileFullscreenManager {
	if (!browser) throw new Error('getMobileFullscreenManager() is browser-only');
	return instance ??= new MobileFullscreenManager();
}
