import { createModuleEffectCoordinator } from './services/create-module-effect-coordinator';
import type { CreateModuleEffectCoordinator } from './services/contracts/types';

export function getCreateModuleEffectCoordinator(): CreateModuleEffectCoordinator {
	return createModuleEffectCoordinator;
}
