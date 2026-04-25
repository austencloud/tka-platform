import { browser } from '$app/environment';
import type { IReversalDetector } from './services/contracts/IReversalDetector';
import { ReversalDetector } from './services/implementations/ReversalDetector';

let instance: IReversalDetector | null = null;

export function getReversalDetector(): IReversalDetector {
	if (!browser) throw new Error('getReversalDetector() is browser-only');
	return instance ??= new ReversalDetector();
}
