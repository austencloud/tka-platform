import { browser } from '$app/environment';

import { CreateModuleHandlers } from './services/implementations/CreateModuleHandlers';
import { getCreateModuleOrchestrator } from './getCreateModuleOrchestrator';
import { getStepOperator } from './getStepOperator';

let instance: CreateModuleHandlers | null = null;

export function getCreateModuleHandlers(): CreateModuleHandlers {
	if (!browser) throw new Error('getCreateModuleHandlers() is browser-only');
	return instance ??= new CreateModuleHandlers(getCreateModuleOrchestrator(), getStepOperator());
}
