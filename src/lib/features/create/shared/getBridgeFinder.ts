import { browser } from '$app/environment';
import type { IBridgeFinder } from './services/contracts/IBridgeFinder';
import { BridgeFinder } from './services/implementations/BridgeFinder';
import { letterQueryHandler } from '$lib/shared/pictograph/tka-glyph/services/implementations/LetterQueryHandler';
import { getPositionAnalyzer } from '$lib/features/create/construct/option-picker/getPositionAnalyzer';
import { getLOOPValidator } from './getLOOPValidator';
import { getSequenceAnalyzer } from './getSequenceAnalyzer';
import { getOrientationAlignmentCalculator } from './getOrientationAlignmentCalculator';

let instance: IBridgeFinder | null = null;

export function getBridgeFinder(): IBridgeFinder {
	if (!browser) throw new Error('getBridgeFinder() is browser-only');
	return instance ??= new BridgeFinder(
		letterQueryHandler,
		getPositionAnalyzer(),
		getLOOPValidator(),
		getSequenceAnalyzer(),
		getOrientationAlignmentCalculator()
	);
}
