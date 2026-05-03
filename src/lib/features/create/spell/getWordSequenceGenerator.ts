import { browser } from '$app/environment';
import { WordSequenceGenerator } from './services/implementations/WordSequenceGenerator';
import { getLetterTransitionGraph } from './getLetterTransitionGraph';
import { letterQueryHandler } from '$lib/shared/pictograph/tka-glyph/services/implementations/LetterQueryHandler';
import { getStepConverter } from '$lib/features/create/generate/shared/getStepConverter';
import { orientationCalculator } from '$lib/shared/pictograph/prop/services/implementations/OrientationCalculator';
import { getSequenceExtender } from '$lib/features/create/shared/getSequenceExtender';
import { getStartPositionValidator } from './getStartPositionValidator';
import { getOrientationContinuityValidator } from './getOrientationContinuityValidator';
import { getReversalDetector } from '$lib/features/create/shared/getReversalDetector';

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
		getOrientationContinuityValidator(),
		getReversalDetector()
	);
}
