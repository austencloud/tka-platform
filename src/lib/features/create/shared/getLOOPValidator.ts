import { browser } from '$app/environment';
import type { ILOOPValidator } from './services/contracts/ILOOPValidator';
import { LOOPValidator } from './services/implementations/LOOPValidator';
import { getLOOPExecutorSelector } from '$lib/features/create/generate/circular/getLOOPExecutors';

let instance: ILOOPValidator | null = null;

export function getLOOPValidator(): ILOOPValidator {
	if (!browser) throw new Error('getLOOPValidator() is browser-only');
	return instance ??= new LOOPValidator(getLOOPExecutorSelector());
}
