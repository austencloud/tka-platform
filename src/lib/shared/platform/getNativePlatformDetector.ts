import { browser } from '$app/environment';
import { PlatformDetector } from './services/implementations/PlatformDetector';

let instance: PlatformDetector | null = null;

export function getNativePlatformDetector(): PlatformDetector {
	if (!browser) throw new Error('getNativePlatformDetector() is browser-only');
	return instance ??= new PlatformDetector();
}
