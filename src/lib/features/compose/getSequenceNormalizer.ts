import { browser } from '$app/environment';
import type { ISequenceNormalizer } from './services/contracts/ISequenceNormalizer';
import { SequenceNormalizer } from './services/implementations/SequenceNormalizer';

let instance: ISequenceNormalizer | null = null;

export function getSequenceNormalizer(): ISequenceNormalizer {
	if (!browser) throw new Error('getSequenceNormalizer() is browser-only');
	return instance ??= new SequenceNormalizer();
}
