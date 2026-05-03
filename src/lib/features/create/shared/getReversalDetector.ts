import { browser } from '$app/environment';

import { ReversalDetector } from './services/implementations/ReversalDetector';

let instance: ReversalDetector | null = null;

export function getReversalDetector(): ReversalDetector {
	if (!browser) throw new Error('getReversalDetector() is browser-only');
	return instance ??= new ReversalDetector();
}
