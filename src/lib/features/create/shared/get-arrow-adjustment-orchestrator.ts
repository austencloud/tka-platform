import { browser } from '$app/environment';

import { ArrowAdjustmentOrchestrator } from './services/arrow-adjustment-orchestrator';
import { screenSpaceAdjustmentTransformer } from '$lib/shared/pictograph/arrow/positioning/calculation/services/screen-space-adjustment-transformer';
import { arrowAdjustmentCalculator } from '$lib/shared/pictograph/arrow/positioning/calculation/services/arrow-adjustment-calculator';
import { arrowLocationCalculator } from '$lib/shared/pictograph/arrow/positioning/calculation/services/arrow-location-calculator';
import { pictographPreparer } from '$lib/shared/pictograph/shared/services/implementations/PictographPreparer';
import { turnsTupleGenerator } from '$lib/shared/pictograph/arrow/positioning/placement/services/implementations/TurnsTupleGenerator';

let instance: ArrowAdjustmentOrchestrator | null = null;

export function getArrowAdjustmentOrchestrator(): ArrowAdjustmentOrchestrator {
	if (!browser) throw new Error('getArrowAdjustmentOrchestrator() is browser-only');
	return instance ??= new ArrowAdjustmentOrchestrator(
		screenSpaceAdjustmentTransformer,
		arrowAdjustmentCalculator,
		arrowLocationCalculator,
		pictographPreparer,
		turnsTupleGenerator
	);
}
