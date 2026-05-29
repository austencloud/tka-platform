import { browser } from '$app/environment';

import { SimilarityCalculator } from './services/similarity-calculator';
import { getStepSignatureGenerator } from './get-step-signature-generator';
import { getSequenceAligner } from './get-sequence-aligner';

let instance: SimilarityCalculator | null = null;

export function getSimilarityCalculator(): SimilarityCalculator {
	if (!browser) throw new Error('getSimilarityCalculator() is browser-only');
	return instance ??= new SimilarityCalculator(getStepSignatureGenerator(), getSequenceAligner());
}
