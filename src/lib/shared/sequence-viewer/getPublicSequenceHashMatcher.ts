import { browser } from '$app/environment';
import { PublicSequenceHashMatcher } from './services/implementations/PublicSequenceHashMatcher';
import { getSequenceEncoder } from '$lib/shared/navigation/getSequenceEncoder';

let instance: PublicSequenceHashMatcher | null = null;

export function getPublicSequenceHashMatcher(): PublicSequenceHashMatcher {
	if (!browser) throw new Error('getPublicSequenceHashMatcher() is browser-only');
	return instance ??= new PublicSequenceHashMatcher(getSequenceEncoder());
}
