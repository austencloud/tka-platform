import { browser } from '$app/environment';
import { StartPositionSelector } from './services/start-position-selector';
import { letterQueryHandler } from '$lib/shared/pictograph/tka-glyph/services/implementations/LetterQueryHandler';
import { getPictographFilter } from './get-pictograph-filter';
import { getStepConverter } from './get-step-converter';

let instance: StartPositionSelector | null = null;

export function getStartPositionSelector(): StartPositionSelector {
	if (!browser) throw new Error('getStartPositionSelector() is browser-only');
	return instance ??= new StartPositionSelector(
		letterQueryHandler,
		getPictographFilter(),
		getStepConverter()
	);
}
