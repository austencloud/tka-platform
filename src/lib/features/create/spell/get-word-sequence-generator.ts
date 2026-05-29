import { browser } from '$app/environment';
import { WordSequenceGenerator } from './services/word-sequence-generator';
import { getLetterTransitionGraph } from './get-letter-transition-graph';
import { letterQueryHandler } from '$lib/shared/pictograph/tka-glyph/services/implementations/LetterQueryHandler';
import { getStepConverter } from '$lib/features/create/generate/shared/get-step-converter';
import { orientationCalculator } from '$lib/shared/pictograph/prop/services/implementations/OrientationCalculator';
import { getSequenceExtender } from '$lib/features/create/shared/get-sequence-extender';
import { getStartPositionValidator } from './get-start-position-validator';
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
