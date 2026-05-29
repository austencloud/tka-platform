import { createModuleEffectCoordinator } from './services/create-module-effect-coordinator';
import type { CreateModuleEffectCoordinator } from './services/create-module-effect-coordinator';

export function getCreateModuleEffectCoordinator(): CreateModuleEffectCoordinator {
	return createModuleEffectCoordinator;
}
