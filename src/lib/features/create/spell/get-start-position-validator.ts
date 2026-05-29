import { browser } from '$app/environment';
import { StartPositionValidator } from './services/start-position-validator';
import { getLetterTransitionGraph } from './get-letter-transition-graph';
import { letterQueryHandler } from '$lib/shared/pictograph/tka-glyph/services/letter-query-handler';

let instance: StartPositionValidator | null = null;

export function getStartPositionValidator(): StartPositionValidator {
	if (!browser) throw new Error('getStartPositionValidator() is browser-only');
	return instance ??= new StartPositionValidator(getLetterTransitionGraph(), letterQueryHandler);
}
