import { browser } from '$app/environment';
import { SequenceNormalizer } from './services/implementations/SequenceNormalizer';

let instance: SequenceNormalizer | null = null;

export function getSequenceNormalizer(): SequenceNormalizer {
	if (!browser) throw new Error('getSequenceNormalizer() is browser-only');
	return instance ??= new SequenceNormalizer();
}
