import { browser } from '$app/environment';

import { LetterDeriver } from './services/letter-deriver';
import { motionQueryHandler } from '$lib/shared/pictograph/shared/services/implementations/MotionQueryHandler';
import { gridModeDeriver } from '$lib/shared/pictograph/grid/services/implementations/GridModeDeriver';

let instance: LetterDeriver | null = null;

export function getLetterDeriver(): LetterDeriver {
	if (!browser) throw new Error('getLetterDeriver() is browser-only');
	return instance ??= new LetterDeriver(motionQueryHandler, gridModeDeriver);
}
