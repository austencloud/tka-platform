import { browser } from '$app/environment';
import type { ICreateModuleHandlers } from './services/contracts/ICreateModuleHandlers';
import { CreateModuleHandlers } from './services/implementations/CreateModuleHandlers';
import { getCreateModuleOrchestrator } from './getCreateModuleOrchestrator';
import { getStepOperator } from './getStepOperator';

let instance: ICreateModuleHandlers | null = null;

export function getCreateModuleHandlers(): ICreateModuleHandlers {
	if (!browser) throw new Error('getCreateModuleHandlers() is browser-only');
	return instance ??= new CreateModuleHandlers(getCreateModuleOrchestrator(), getStepOperator());
}
