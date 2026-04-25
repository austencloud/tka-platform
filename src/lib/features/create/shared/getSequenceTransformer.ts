import { browser } from '$app/environment';
import type { ISequenceTransformer } from './services/contracts/ISequenceTransformer';
import { SequenceTransformer } from './services/implementations/sequence-transforms/SequenceTransformer';
import { motionQueryHandler } from '$lib/shared/pictograph/shared/services/implementations/MotionQueryHandler';
import { orientationCalculator } from '$lib/shared/pictograph/prop/services/implementations/OrientationCalculator';
import { gridPositionDeriver } from '$lib/shared/pictograph/grid/services/implementations/GridPositionDeriver';
import { getReversalDetector } from './getReversalDetector';

let instance: ISequenceTransformer | null = null;

export function getSequenceTransformer(): ISequenceTransformer {
	if (!browser) throw new Error('getSequenceTransformer() is browser-only');
	return instance ??= new SequenceTransformer(
		motionQueryHandler,
		orientationCalculator,
		getReversalDetector(),
		gridPositionDeriver
	);
}
