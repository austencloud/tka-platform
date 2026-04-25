import { browser } from '$app/environment';
import type { ICreateModuleInitializer } from './services/contracts/ICreateModuleInitializer';
import { CreateModuleInitializer } from './services/implementations/CreateModuleInitializer';
import { getSequenceRepository } from './getSequenceRepository';
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
import { getSharer } from '$lib/shared/share/getSharer';
import { getPanelPersister } from './getPanelPersister';
import { getSequenceStatsCalculator } from './getSequenceStatsCalculator';
import { getSequenceTransformer } from './getSequenceTransformer';
import { getSequenceValidator } from './getSequenceValidator';

let instance: ICreateModuleInitializer | null = null;

export function getCreateModuleInitializer(): ICreateModuleInitializer {
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
		getSequenceStatsCalculator(),
		getSequenceTransformer(),
		getSequenceValidator()
	);
}
