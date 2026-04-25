import { browser } from '$app/environment';
import type { IStartPositionValidator } from './services/contracts/IStartPositionValidator';
import { StartPositionValidator } from './services/implementations/StartPositionValidator';
import { getLetterTransitionGraph } from './getLetterTransitionGraph';
import { letterQueryHandler } from '$lib/shared/pictograph/tka-glyph/services/implementations/LetterQueryHandler';

let instance: IStartPositionValidator | null = null;

export function getStartPositionValidator(): IStartPositionValidator {
	if (!browser) throw new Error('getStartPositionValidator() is browser-only');
	return instance ??= new StartPositionValidator(getLetterTransitionGraph(), letterQueryHandler);
}
