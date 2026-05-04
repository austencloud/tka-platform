import { browser } from '$app/environment';

import { RandomSequenceGenerator } from './services/implementations/RandomSequenceGenerator';
import * as loopEndPositionResolver from './services/loop-end-position-resolver';
import { letterQueryHandler } from '$lib/shared/pictograph/tka-glyph/services/implementations/LetterQueryHandler';
import { orientationCalculator } from '$lib/shared/pictograph/prop/services/implementations/OrientationCalculator';
import { getStartPositionValidator } from './getStartPositionValidator';
import * as orientationContinuityValidator from './services/orientation-continuity-validator';
import { getSequenceExtender } from '$lib/features/create/shared/getSequenceExtender';
import { getStepConverter } from '$lib/features/create/generate/shared/getStepConverter';
import { reversalDetector } from '$lib/features/create/shared/services/reversal-detector';

let instance: RandomSequenceGenerator | null = null;

export function getRandomSequenceGenerator(): RandomSequenceGenerator {
	if (!browser) throw new Error('getRandomSequenceGenerator() is browser-only');
	return instance ??= new RandomSequenceGenerator(
		letterQueryHandler,
		getStartPositionValidator(),
		orientationContinuityValidator,
		orientationCalculator,
		getSequenceExtender(),
		getStepConverter(),
		reversalDetector,
		loopEndPositionResolver
	);
}
