import { browser } from '$app/environment';

import { CreateModuleEffectCoordinator } from './services/implementations/CreateModuleEffectCoordinator';

let instance: CreateModuleEffectCoordinator | null = null;

export function getCreateModuleEffectCoordinator(): CreateModuleEffectCoordinator {
	if (!browser) throw new Error('getCreateModuleEffectCoordinator() is browser-only');
	return instance ??= new CreateModuleEffectCoordinator();
}
