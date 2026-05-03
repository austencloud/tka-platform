import { browser } from '$app/environment';
import { SanityChecker } from './services/implementations/SanityChecker';

let instance: SanityChecker | null = null;

export function getSanityChecker(): SanityChecker {
	if (!browser) throw new Error('getSanityChecker() is browser-only');
	return instance ??= new SanityChecker();
}
