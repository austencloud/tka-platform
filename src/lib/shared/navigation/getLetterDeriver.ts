import { browser } from '$app/environment';
import type { ILetterDeriver } from './services/contracts/ILetterDeriver';
import { LetterDeriver } from './services/implementations/LetterDeriver';
import { motionQueryHandler } from '$lib/shared/pictograph/shared/services/implementations/MotionQueryHandler';
import { gridModeDeriver } from '$lib/shared/pictograph/grid/services/implementations/GridModeDeriver';

let instance: ILetterDeriver | null = null;

export function getLetterDeriver(): ILetterDeriver {
	if (!browser) throw new Error('getLetterDeriver() is browser-only');
	return instance ??= new LetterDeriver(motionQueryHandler, gridModeDeriver);
}
