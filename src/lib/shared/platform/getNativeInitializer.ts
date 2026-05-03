import { browser } from '$app/environment';
import { NativeInitializer } from './services/implementations/NativeInitializer';
import { getNativePlatformDetector } from './getNativePlatformDetector';

let instance: NativeInitializer | null = null;

export function getNativeInitializer(): NativeInitializer {
	if (!browser) throw new Error('getNativeInitializer() is browser-only');
	return instance ??= new NativeInitializer(getNativePlatformDetector());
}
