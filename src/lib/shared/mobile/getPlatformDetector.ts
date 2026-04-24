import { browser } from '$app/environment';
import type { IPlatformDetector } from './services/contracts/IPlatformDetector';
import { PlatformDetector } from './services/implementations/PlatformDetector';

let instance: IPlatformDetector | null = null;

export function getPlatformDetector(): IPlatformDetector {
	if (!browser) throw new Error('getPlatformDetector() is browser-only');
	return instance ??= new PlatformDetector();
}
