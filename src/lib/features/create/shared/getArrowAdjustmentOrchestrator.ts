import { browser } from '$app/environment';

import { ArrowAdjustmentOrchestrator } from './services/implementations/ArrowAdjustmentOrchestrator';
import { getKeyboardArrowAdjuster } from './getKeyboardArrowAdjuster';
import { screenSpaceAdjustmentTransformer } from '$lib/shared/pictograph/arrow/positioning/calculation/services/implementations/ScreenSpaceAdjustmentTransformer';
import { arrowAdjustmentCalculator } from '$lib/shared/pictograph/arrow/positioning/calculation/services/implementations/ArrowAdjustmentCalculator';
import { arrowLocationCalculator } from '$lib/shared/pictograph/arrow/positioning/calculation/services/implementations/ArrowLocationCalculator';
import { pictographPreparer } from '$lib/shared/pictograph/shared/services/implementations/PictographPreparer';
import { turnsTupleGenerator } from '$lib/shared/pictograph/arrow/positioning/placement/services/implementations/TurnsTupleGenerator';

let instance: ArrowAdjustmentOrchestrator | null = null;

export function getArrowAdjustmentOrchestrator(): ArrowAdjustmentOrchestrator {
	if (!browser) throw new Error('getArrowAdjustmentOrchestrator() is browser-only');
	return instance ??= new ArrowAdjustmentOrchestrator(
		getKeyboardArrowAdjuster(),
		screenSpaceAdjustmentTransformer,
		arrowAdjustmentCalculator,
		arrowLocationCalculator,
		pictographPreparer,
		turnsTupleGenerator
	);
}
