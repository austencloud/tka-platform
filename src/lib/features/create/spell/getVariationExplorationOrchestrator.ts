import { browser } from '$app/environment';
import type { IVariationExplorationOrchestrator } from './services/contracts/IVariationExplorationOrchestrator';
import { VariationExplorationOrchestrator } from './services/implementations/VariationExplorationOrchestrator';
import { getSpellServiceLoader } from './getSpellServiceLoader';

let instance: IVariationExplorationOrchestrator | null = null;

export function getVariationExplorationOrchestrator(): IVariationExplorationOrchestrator {
	if (!browser) throw new Error('getVariationExplorationOrchestrator() is browser-only');
	return instance ??= new VariationExplorationOrchestrator(getSpellServiceLoader());
}
