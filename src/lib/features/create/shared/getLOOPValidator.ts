import { browser } from '$app/environment';

import { LOOPValidator } from './services/implementations/LOOPValidator';
import { getLOOPExecutorSelector } from '$lib/features/create/generate/circular/getLOOPExecutors';

let instance: LOOPValidator | null = null;

export function getLOOPValidator(): LOOPValidator {
	if (!browser) throw new Error('getLOOPValidator() is browser-only');
	return instance ??= new LOOPValidator(getLOOPExecutorSelector());
}
