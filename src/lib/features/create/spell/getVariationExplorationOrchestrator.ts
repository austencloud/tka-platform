import { browser } from '$app/environment';

import { VariationExplorationOrchestrator } from './services/implementations/VariationExplorationOrchestrator';
import { getSpellServiceLoader } from './getSpellServiceLoader';

let instance: VariationExplorationOrchestrator | null = null;

export function getVariationExplorationOrchestrator(): VariationExplorationOrchestrator {
	if (!browser) throw new Error('getVariationExplorationOrchestrator() is browser-only');
	return instance ??= new VariationExplorationOrchestrator(getSpellServiceLoader());
}
