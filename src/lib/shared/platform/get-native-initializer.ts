import { browser } from '$app/environment';
import { NativeInitializer } from './services/native-initializer';

let instance: NativeInitializer | null = null;

export function getNativeInitializer(): NativeInitializer {
	if (!browser) throw new Error('getNativeInitializer() is browser-only');
	return instance ??= new NativeInitializer();
}
