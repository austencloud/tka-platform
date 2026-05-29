import { browser } from '$app/environment';
import { BridgeFinder } from './services/bridge-finder';
import { letterQueryHandler } from '$lib/shared/pictograph/tka-glyph/services/implementations/LetterQueryHandler';
import { getPositionAnalyzer } from '$lib/features/create/construct/option-picker/get-position-analyzer';
import { getLOOPValidator } from './get-loop-validator';
import { getSequenceAnalyzer } from './get-sequence-analyzer';
import { getOrientationAlignmentCalculator } from './get-orientation-alignment-calculator';

let instance: BridgeFinder | null = null;

export function getBridgeFinder(): BridgeFinder {
	if (!browser) throw new Error('getBridgeFinder() is browser-only');
	return instance ??= new BridgeFinder(
		letterQueryHandler,
		getPositionAnalyzer(),
		getLOOPValidator(),
		getSequenceAnalyzer(),
		getOrientationAlignmentCalculator()
	);
}
