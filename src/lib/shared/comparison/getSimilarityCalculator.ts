import { browser } from '$app/environment';
import type { ISimilarityCalculator } from './services/contracts/ISimilarityCalculator';
import { SimilarityCalculator } from './services/implementations/SimilarityCalculator';
import { getBeatSignatureGenerator } from './getBeatSignatureGenerator';
import { getSequenceAligner } from './getSequenceAligner';

let instance: ISimilarityCalculator | null = null;

export function getSimilarityCalculator(): ISimilarityCalculator {
	if (!browser) throw new Error('getSimilarityCalculator() is browser-only');
	return instance ??= new SimilarityCalculator(getBeatSignatureGenerator(), getSequenceAligner());
}
