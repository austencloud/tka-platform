import { browser } from '$app/environment';

import { DeepLinkSequenceHandler } from './services/deep-link-sequence-handler';
import { getDeepLinker } from '$lib/shared/navigation/getDeepLinker';
import { getLetterDeriver } from '$lib/shared/navigation/getLetterDeriver';
import { getPositionDeriver } from '$lib/shared/navigation/getPositionDeriver';

let instance: DeepLinkSequenceHandler | null = null;

export function getDeepLinkSequenceHandler(): DeepLinkSequenceHandler {
	if (!browser) throw new Error('getDeepLinkSequenceHandler() is browser-only');
	return instance ??= new DeepLinkSequenceHandler(getDeepLinker(), getLetterDeriver(), getPositionDeriver());
}
