import { browser } from '$app/environment';
import { PlatformDetector } from './services/implementations/PlatformDetector';

let instance: PlatformDetector | null = null;

export function getPlatformDetector(): PlatformDetector {
	if (!browser) throw new Error('getPlatformDetector() is browser-only');
	return instance ??= new PlatformDetector();
}
