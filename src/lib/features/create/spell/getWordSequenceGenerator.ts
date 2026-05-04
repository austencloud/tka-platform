import { browser } from '$app/environment';
import { WordSequenceGenerator } from './services/implementations/WordSequenceGenerator';
import { getLetterTransitionGraph } from './getLetterTransitionGraph';
import { letterQueryHandler } from '$lib/shared/pictograph/tka-glyph/services/implementations/LetterQueryHandler';
import { getStepConverter } from '$lib/features/create/generate/shared/getStepConverter';
import { orientationCalculator } from '$lib/shared/pictograph/prop/services/implementations/OrientationCalculator';
import { getSequenceExtender } from '$lib/features/create/shared/getSequenceExtender';
import { getStartPositionValidator } from './getStartPositionValidator';
import * as orientationContinuityValidator from './services/orientation-continuity-validator';
import { reversalDetector } from '$lib/shared/create/services/reversal-detector';

let instance: WordSequenceGenerator | null = null;

export function getWordSequenceGenerator(): WordSequenceGenerator {
	if (!browser) throw new Error('getWordSequenceGenerator() is browser-only');
	return instance ??= new WordSequenceGenerator(
		getLetterTransitionGraph(),
		letterQueryHandler,
		getStepConverter(),
		orientationCalculator,
		getSequenceExtender(),
		getStartPositionValidator(),
		orientationContinuityValidator,
		reversalDetector
	);
}
