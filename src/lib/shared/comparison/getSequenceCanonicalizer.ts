import { browser } from '$app/environment';

import { SequenceCanonicalizer } from './services/implementations/SequenceCanonicalizer';
import { getStepSignatureGenerator } from './getStepSignatureGenerator';
import * as wordCyclicEquivalenceDetector from '$lib/shared/foundation/utils/word-cyclic-equivalence-detector';

let instance: SequenceCanonicalizer | null = null;

export function getSequenceCanonicalizer(): SequenceCanonicalizer {
	if (!browser) throw new Error('getSequenceCanonicalizer() is browser-only');
	return instance ??= new SequenceCanonicalizer(getStepSignatureGenerator(), wordCyclicEquivalenceDetector);
}
