import { browser } from '$app/environment';
import type { ISequenceLoopabilityChecker } from './services/contracts/ISequenceLoopabilityChecker';
import { SequenceLoopabilityChecker } from './services/implementations/SequenceLoopabilityChecker';

let instance: ISequenceLoopabilityChecker | null = null;

export function getSequenceLoopabilityChecker(): ISequenceLoopabilityChecker {
	if (!browser) throw new Error('getSequenceLoopabilityChecker() is browser-only');
	return instance ??= new SequenceLoopabilityChecker();
}
