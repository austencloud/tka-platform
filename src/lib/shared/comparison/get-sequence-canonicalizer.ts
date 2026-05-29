import { browser } from '$app/environment';

import { SequenceCanonicalizer } from './services/sequence-canonicalizer';
import { getStepSignatureGenerator } from './get-step-signature-generator';
import * as wordCyclicEquivalenceDetector from '$lib/shared/foundation/utils/word-cyclic-equivalence-detector';

let instance: SequenceCanonicalizer | null = null;

export function getSequenceCanonicalizer(): SequenceCanonicalizer {
	if (!browser) throw new Error('getSequenceCanonicalizer() is browser-only');
	return instance ??= new SequenceCanonicalizer(getStepSignatureGenerator(), wordCyclicEquivalenceDetector);
}
