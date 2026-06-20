import { browser } from '$app/environment';

import { SequenceEquivalenceDetector } from './services/sequence-equivalence-detector';
import { getSequenceCanonicalizer } from './get-sequence-canonicalizer';
import { getStepSignatureGenerator } from './get-step-signature-generator';
import { getSpatialTransformDetector } from './get-spatial-transform-detector';
import * as wordCyclicEquivalenceDetector from '$lib/shared/foundation/utils/word-cyclic-equivalence-detector';

let instance: SequenceEquivalenceDetector | null = null;

export function getSequenceEquivalenceDetector(): SequenceEquivalenceDetector {
	if (!browser) throw new Error('getSequenceEquivalenceDetector() is browser-only');
	return instance ??= new SequenceEquivalenceDetector(
		getSequenceCanonicalizer(),
		getStepSignatureGenerator(),
		getSpatialTransformDetector(),
		wordCyclicEquivalenceDetector
	);
}
