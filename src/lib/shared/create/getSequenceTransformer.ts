import { browser } from '$app/environment';
import { SequenceTransformer } from '$lib/shared/create/services/SequenceTransformer';
import { motionQueryHandler } from '$lib/shared/pictograph/shared/services/motion-query-handler';
import { orientationCalculator } from '$lib/shared/pictograph/prop/services/implementations/OrientationCalculator';
import { gridPositionDeriver } from '$lib/shared/pictograph/grid/services/implementations/GridPositionDeriver';
import { getReversalDetector } from '$lib/shared/create/getReversalDetector';

let instance: SequenceTransformer | null = null;

export function getSequenceTransformer(): SequenceTransformer {
	if (!browser) throw new Error('getSequenceTransformer() is browser-only');
	return instance ??= new SequenceTransformer(
		motionQueryHandler,
		orientationCalculator,
		getReversalDetector(),
		gridPositionDeriver
	);
}
