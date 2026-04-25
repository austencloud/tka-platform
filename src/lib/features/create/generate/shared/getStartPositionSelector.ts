import { browser } from '$app/environment';
import type { IStartPositionSelector } from './services/contracts/IStartPositionSelector';
import { StartPositionSelector } from './services/implementations/StartPositionSelector';
import { letterQueryHandler } from '$lib/shared/pictograph/tka-glyph/services/implementations/LetterQueryHandler';
import { arrowPositioningOrchestrator } from '$lib/shared/pictograph/arrow/orchestration/services/implementations/ArrowPositioningOrchestrator';
import { getPictographFilter } from './getPictographFilter';
import { getStepConverter } from './getStepConverter';

let instance: IStartPositionSelector | null = null;

export function getStartPositionSelector(): IStartPositionSelector {
	if (!browser) throw new Error('getStartPositionSelector() is browser-only');
	return instance ??= new StartPositionSelector(
		letterQueryHandler,
		getPictographFilter(),
		getStepConverter(),
		arrowPositioningOrchestrator
	);
}
