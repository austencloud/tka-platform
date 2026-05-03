import { browser } from '$app/environment';
import { SequenceLoopabilityChecker } from './services/implementations/SequenceLoopabilityChecker';

let instance: SequenceLoopabilityChecker | null = null;

export function getSequenceLoopabilityChecker(): SequenceLoopabilityChecker {
	if (!browser) throw new Error('getSequenceLoopabilityChecker() is browser-only');
	return instance ??= new SequenceLoopabilityChecker();
}
