import { reversalDetector } from './services/reversal-detector';
import type { ReversalDetector } from './services/reversal-detector';

export function getReversalDetector(): ReversalDetector {
	return reversalDetector;
}
