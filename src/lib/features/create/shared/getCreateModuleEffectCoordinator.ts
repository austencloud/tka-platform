import { browser } from '$app/environment';
import type { ICreateModuleEffectCoordinator } from './services/contracts/ICreateModuleEffectCoordinator';
import { CreateModuleEffectCoordinator } from './services/implementations/CreateModuleEffectCoordinator';

let instance: ICreateModuleEffectCoordinator | null = null;

export function getCreateModuleEffectCoordinator(): ICreateModuleEffectCoordinator {
	if (!browser) throw new Error('getCreateModuleEffectCoordinator() is browser-only');
	return instance ??= new CreateModuleEffectCoordinator();
}
