import { browser } from '$app/environment';
import type { ISequenceCanonicalizer } from './services/contracts/ISequenceCanonicalizer';
import { SequenceCanonicalizer } from './services/implementations/SequenceCanonicalizer';
import { getBeatSignatureGenerator } from './getBeatSignatureGenerator';
import { getWordCyclicEquivalenceDetector } from '$lib/features/create/shared/getWordCyclicEquivalenceDetector';

let instance: ISequenceCanonicalizer | null = null;

export function getSequenceCanonicalizer(): ISequenceCanonicalizer {
	if (!browser) throw new Error('getSequenceCanonicalizer() is browser-only');
	return instance ??= new SequenceCanonicalizer(getBeatSignatureGenerator(), getWordCyclicEquivalenceDetector());
}
