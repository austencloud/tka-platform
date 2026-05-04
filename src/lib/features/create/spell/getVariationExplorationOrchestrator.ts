import { browser } from '$app/environment';

import { variationExplorationOrchestrator } from './services/implementations/VariationExplorationOrchestrator';

export function getVariationExplorationOrchestrator() {
	if (!browser) throw new Error('getVariationExplorationOrchestrator() is browser-only');
	return variationExplorationOrchestrator;
}
