import { browser } from '$app/environment';

import { CreateModuleInitializer } from './services/implementations/CreateModuleInitializer';
import { getSequenceRepository } from '$lib/shared/create/getSequenceRepository';
import { getSequencePersister } from './getSequencePersister';
import { getStartPositionManager } from '$lib/features/create/construct/start-position-picker/getStartPositionManager';
import { getCreateModuleOrchestrator } from './getCreateModuleOrchestrator';
import { getResponsiveLayoutManager } from './getResponsiveLayoutManager';
import { getNavigationSyncer } from './getNavigationSyncer';
import { getStepOperator } from './getStepOperator';
import { getDeepLinkSequenceHandler } from './getDeepLinkSequenceHandler';
import { getDeepLinker } from '$lib/shared/navigation/getDeepLinker';
import { getCreateModuleHandlers } from './getCreateModuleHandlers';
import { getCreateModuleEffectCoordinator } from './getCreateModuleEffectCoordinator';
import { getSharer } from '$lib/shared/share/get-sharer';
import { getPanelPersister } from './getPanelPersister';
import * as sequenceStatsCalculator from './services/sequence-stats-calculator';
import { getSequenceTransformer } from '$lib/shared/create/getSequenceTransformer';
import * as sequenceValidator from './services/sequence-validator';

let instance: CreateModuleInitializer | null = null;

export function getCreateModuleInitializer(): CreateModuleInitializer {
	if (!browser) throw new Error('getCreateModuleInitializer() is browser-only');
	return instance ??= new CreateModuleInitializer(
		getSequenceRepository(),
		getSequencePersister(),
		getStartPositionManager(),
		getCreateModuleOrchestrator(),
		getResponsiveLayoutManager(),
		getNavigationSyncer(),
		getStepOperator(),
		getDeepLinkSequenceHandler(),
		getDeepLinker()!,
		getCreateModuleHandlers(),
		getCreateModuleEffectCoordinator(),
		getSharer(),
		getPanelPersister(),
		sequenceStatsCalculator,
		getSequenceTransformer(),
		sequenceValidator
	);
}
