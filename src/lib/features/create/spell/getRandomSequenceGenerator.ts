import { browser } from '$app/environment';

import { RandomSequenceGenerator } from './services/implementations/RandomSequenceGenerator';
import { LOOPEndPositionResolver } from './services/implementations/LOOPEndPositionResolver';
import { letterQueryHandler } from '$lib/shared/pictograph/tka-glyph/services/implementations/LetterQueryHandler';
import { orientationCalculator } from '$lib/shared/pictograph/prop/services/implementations/OrientationCalculator';
import { getStartPositionValidator } from './getStartPositionValidator';
import { getOrientationContinuityValidator } from './getOrientationContinuityValidator';
import { getSequenceExtender } from '$lib/features/create/shared/getSequenceExtender';
import { getStepConverter } from '$lib/features/create/generate/shared/getStepConverter';
import { getReversalDetector } from '$lib/features/create/shared/getReversalDetector';

let instance: RandomSequenceGenerator | null = null;

export function getRandomSequenceGenerator(): RandomSequenceGenerator {
	if (!browser) throw new Error('getRandomSequenceGenerator() is browser-only');
	return instance ??= new RandomSequenceGenerator(
		letterQueryHandler,
		getStartPositionValidator(),
		getOrientationContinuityValidator(),
		orientationCalculator,
		getSequenceExtender(),
		getStepConverter(),
		getReversalDetector(),
		new LOOPEndPositionResolver()
	);
}
