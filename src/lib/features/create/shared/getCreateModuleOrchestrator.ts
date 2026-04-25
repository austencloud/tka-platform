import { browser } from '$app/environment';
import type { ICreateModuleOrchestrator } from './services/contracts/ICreateModuleOrchestrator';
import { CreateModuleOrchestrator } from './services/implementations/CreateModuleOrchestrator';

let instance: ICreateModuleOrchestrator | null = null;

export function getCreateModuleOrchestrator(): ICreateModuleOrchestrator {
	if (!browser) throw new Error('getCreateModuleOrchestrator() is browser-only');
	return instance ??= new CreateModuleOrchestrator();
}
