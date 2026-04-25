import { browser } from '$app/environment';
import type { ISanityChecker } from './services/contracts/ISanityChecker';
import { SanityChecker } from './services/implementations/SanityChecker';

let instance: ISanityChecker | null = null;

export function getSanityChecker(): ISanityChecker {
	if (!browser) throw new Error('getSanityChecker() is browser-only');
	return instance ??= new SanityChecker();
}
