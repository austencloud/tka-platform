import { browser } from '$app/environment';
import type { IUsernameValidator } from './services/contracts/IUsernameValidator';
import { UsernameValidator } from './services/implementations/UsernameValidator';

let instance: IUsernameValidator | null = null;

export function getUsernameValidator(): IUsernameValidator {
	if (!browser) throw new Error('getUsernameValidator() is browser-only');
	return instance ??= new UsernameValidator();
}
