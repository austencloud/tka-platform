import { browser } from '$app/environment';

import { CreateModuleInitializer } from './services/create-module-initializer';
import { getSequenceRepository } from '$lib/shared/create/getSequenceRepository';
import { getSequencePersister } from './get-sequence-persister';
import { getStartPositionManager } from '$lib/features/create/construct/start-position-picker/get-start-position-manager';
import { getCreateModuleOrchestrator } from './get-create-module-orchestrator';
import { getResponsiveLayoutManager } from './get-responsive-layout-manager';
import { getNavigationSyncer } from './get-navigation-syncer';
import { getStepOperator } from './get-step-operator';
import { getDeepLinkSequenceHandler } from './get-deep-link-sequence-handler';
import { getDeepLinker } from '$lib/shared/navigation/getDeepLinker';
import { getCreateModuleHandlers } from './get-create-module-handlers';
import { getCreateModuleEffectCoordinator } from './get-create-module-effect-coordinator';
import { getSharer } from '$lib/shared/share/get-sharer';
import { getPanelPersister } from './get-panel-persister';
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
