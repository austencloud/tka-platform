import { browser } from '$app/environment';
import { StartPositionValidator } from './services/implementations/StartPositionValidator';
import { getLetterTransitionGraph } from './getLetterTransitionGraph';
import { letterQueryHandler } from '$lib/shared/pictograph/tka-glyph/services/implementations/LetterQueryHandler';

let instance: StartPositionValidator | null = null;

export function getStartPositionValidator(): StartPositionValidator {
	if (!browser) throw new Error('getStartPositionValidator() is browser-only');
	return instance ??= new StartPositionValidator(getLetterTransitionGraph(), letterQueryHandler);
}
