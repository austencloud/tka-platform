import { browser } from '$app/environment';

import { SimilarityCalculator } from './services/implementations/SimilarityCalculator';
import { getStepSignatureGenerator } from './getStepSignatureGenerator';
import { getSequenceAligner } from './getSequenceAligner';

let instance: SimilarityCalculator | null = null;

export function getSimilarityCalculator(): SimilarityCalculator {
	if (!browser) throw new Error('getSimilarityCalculator() is browser-only');
	return instance ??= new SimilarityCalculator(getStepSignatureGenerator(), getSequenceAligner());
}
