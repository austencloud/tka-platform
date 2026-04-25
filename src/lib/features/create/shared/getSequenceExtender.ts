import { browser } from '$app/environment';
import type { ISequenceExtender } from './services/contracts/ISequenceExtender';
import { SequenceExtender } from './services/implementations/SequenceExtender';
import { getLOOPExecutorSelector } from '$lib/features/create/generate/circular/getLOOPExecutors';
import { getReversalDetector } from './getReversalDetector';
import { letterQueryHandler } from '$lib/shared/pictograph/tka-glyph/services/implementations/LetterQueryHandler';
import { getStepConverter } from '$lib/features/create/generate/shared/getStepConverter';
import { orientationCalculator } from '$lib/shared/pictograph/prop/services/implementations/OrientationCalculator';
import { getLOOPValidator } from './getLOOPValidator';
import { getSequenceAnalyzer } from './getSequenceAnalyzer';
import { getBridgeFinder } from './getBridgeFinder';
import { motionQueryHandler } from '$lib/shared/pictograph/shared/services/implementations/MotionQueryHandler';
import { gridModeDeriver } from '$lib/shared/pictograph/grid/services/implementations/GridModeDeriver';

let instance: ISequenceExtender | null = null;

export function getSequenceExtender(): ISequenceExtender {
	if (!browser) throw new Error('getSequenceExtender() is browser-only');
	return instance ??= new SequenceExtender(
		getLOOPExecutorSelector(),
		getReversalDetector(),
		letterQueryHandler,
		getStepConverter(),
		orientationCalculator,
		getLOOPValidator(),
		getSequenceAnalyzer(),
		getBridgeFinder(),
		motionQueryHandler,
		gridModeDeriver
	);
}
