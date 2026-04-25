import { browser } from '$app/environment';
import { SequenceEquivalenceDetector } from './services/implementations/SequenceEquivalenceDetector';
import { getSequenceCanonicalizer } from './getSequenceCanonicalizer';
import { getStepSignatureGenerator } from './getStepSignatureGenerator';
import { getSpatialTransformDetector } from './getSpatialTransformDetector';
import { getWordCyclicEquivalenceDetector } from '$lib/features/create/shared/getWordCyclicEquivalenceDetector';

let instance: SequenceEquivalenceDetector | null = null;

export function getSequenceEquivalenceDetector(): SequenceEquivalenceDetector {
	if (typeof window === 'undefined') throw new Error('getSequenceEquivalenceDetector() is browser-only');
	return instance ??= new SequenceEquivalenceDetector(
		getSequenceCanonicalizer(),
		getStepSignatureGenerator(),
		getSpatialTransformDetector(),
		getWordCyclicEquivalenceDetector()
	);
}
