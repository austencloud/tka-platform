import { browser } from '$app/environment';

import { UsernameValidator } from './services/implementations/UsernameValidator';

let instance: UsernameValidator | null = null;

export function getUsernameValidator(): UsernameValidator {
	if (!browser) throw new Error('getUsernameValidator() is browser-only');
	return instance ??= new UsernameValidator();
}
