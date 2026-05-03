import { browser } from '$app/environment';
import { StepComparisonOrchestrator } from './services/implementations/comparison/StepComparisonOrchestrator';
import { getRotationComparer } from './getRotationComparer';
import { getReflectionComparer } from './getReflectionComparer';
import { getSwapInvertComparer } from './getSwapInvertComparer';
import { getCandidateFormatter } from './getCandidateFormatter';

let instance: StepComparisonOrchestrator | null = null;

export function getStepComparisonOrchestrator(): StepComparisonOrchestrator {
	if (!browser) throw new Error('getStepComparisonOrchestrator() is browser-only');
	return instance ??= new StepComparisonOrchestrator(
		getRotationComparer(),
		getReflectionComparer(),
		getSwapInvertComparer(),
		getCandidateFormatter(),
	);
}
