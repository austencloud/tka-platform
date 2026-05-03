import { browser } from '$app/environment';
import { CreateModuleOrchestrator } from './services/implementations/CreateModuleOrchestrator';

let instance: CreateModuleOrchestrator | null = null;

export function getCreateModuleOrchestrator(): CreateModuleOrchestrator {
	if (!browser) throw new Error('getCreateModuleOrchestrator() is browser-only');
	return instance ??= new CreateModuleOrchestrator();
}
