import { browser } from '$app/environment';

import { SequenceAnalyzer } from './services/sequence-analyzer';
import { betaDetector } from '$lib/shared/pictograph/prop/services/implementations/BetaDetector';

let instance: SequenceAnalyzer | null = null;

export function getSequenceAnalyzer(): SequenceAnalyzer {
	if (!browser) throw new Error('getSequenceAnalyzer() is browser-only');
	return instance ??= new SequenceAnalyzer(betaDetector);
}
