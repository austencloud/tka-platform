import { browser } from '$app/environment';
import type { IReversalChecker } from './services/contracts/IReversalChecker';
import { ReversalChecker } from './services/implementations/ReversalChecker';

let instance: IReversalChecker | null = null;

export function getReversalChecker(): IReversalChecker {
	if (!browser) throw new Error('getReversalChecker() is browser-only');
	return instance ??= new ReversalChecker();
}
