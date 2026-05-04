import { browser } from '$app/environment';
import { StartPositionSelector } from './services/implementations/StartPositionSelector';
import { letterQueryHandler } from '$lib/shared/pictograph/tka-glyph/services/implementations/LetterQueryHandler';
import { getPictographFilter } from './getPictographFilter';
import { getStepConverter } from './getStepConverter';

let instance: StartPositionSelector | null = null;

export function getStartPositionSelector(): StartPositionSelector {
	if (!browser) throw new Error('getStartPositionSelector() is browser-only');
	return instance ??= new StartPositionSelector(
		letterQueryHandler,
		getPictographFilter(),
		getStepConverter()
	);
}
