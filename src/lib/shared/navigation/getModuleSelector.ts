import { browser } from '$app/environment';
import type { IModuleSelector } from './services/contracts/IModuleSelector';
import { ModuleSelector } from './services/ModuleSelector';

let instance: IModuleSelector | null = null;

export function getModuleSelector(): IModuleSelector {
	if (!browser) throw new Error('getModuleSelector() is browser-only');
	return instance ??= new ModuleSelector();
}
