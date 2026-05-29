import { browser } from '$app/environment';
import { DeepLinker } from './services/deep-linker';

let instance: DeepLinker | null = null;

export function getDeepLinker(): DeepLinker {
	if (!browser) throw new Error('getDeepLinker() is browser-only');
	return instance ??= new DeepLinker();
}
