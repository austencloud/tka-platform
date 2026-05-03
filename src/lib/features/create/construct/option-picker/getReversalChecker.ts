import { browser } from '$app/environment';
import { ReversalChecker } from './services/implementations/ReversalChecker';

let instance: ReversalChecker | null = null;

export function getReversalChecker(): ReversalChecker {
	if (!browser) throw new Error('getReversalChecker() is browser-only');
	return instance ??= new ReversalChecker();
}
