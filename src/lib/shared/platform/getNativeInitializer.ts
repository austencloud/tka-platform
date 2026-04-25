import { browser } from '$app/environment';
import type { INativeInitializer } from './services/contracts/INativeInitializer';
import { NativeInitializer } from './services/implementations/NativeInitializer';
import { getNativePlatformDetector } from './getNativePlatformDetector';

let instance: INativeInitializer | null = null;

export function getNativeInitializer(): INativeInitializer {
	if (!browser) throw new Error('getNativeInitializer() is browser-only');
	return instance ??= new NativeInitializer(getNativePlatformDetector());
}
