import { browser } from '$app/environment';

import { LetterDeriver } from './services/letter-deriver';
import { motionQueryHandler } from '$lib/shared/pictograph/shared/services/motion-query-handler';

let instance: LetterDeriver | null = null;

export function getLetterDeriver(): LetterDeriver {
	if (!browser) throw new Error('getLetterDeriver() is browser-only');
	return instance ??= new LetterDeriver(motionQueryHandler);
}
