import { browser } from '$app/environment';
import type { IPublicSequenceHashMatcher } from './services/contracts/IPublicSequenceHashMatcher';
import { PublicSequenceHashMatcher } from './services/implementations/PublicSequenceHashMatcher';
import { getSequenceEncoder } from '$lib/shared/navigation/getSequenceEncoder';

let instance: IPublicSequenceHashMatcher | null = null;

export function getPublicSequenceHashMatcher(): IPublicSequenceHashMatcher {
	if (!browser) throw new Error('getPublicSequenceHashMatcher() is browser-only');
	return instance ??= new PublicSequenceHashMatcher(getSequenceEncoder());
}
