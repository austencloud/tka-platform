import { reversalDetector } from '$lib/shared/create/services/reversal-detector';
import type { ReversalDetector } from '$lib/shared/create/services/reversal-detector';

export function getReversalDetector(): ReversalDetector {
	return reversalDetector;
}
