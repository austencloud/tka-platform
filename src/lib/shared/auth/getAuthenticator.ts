import { browser } from '$app/environment';
import type { IAuthenticator } from './services/contracts/IAuthenticator';
import { Authenticator } from './services/implementations/Authenticator';

let instance: IAuthenticator | null = null;

export function getAuthenticator(): IAuthenticator {
	if (!browser) throw new Error('getAuthenticator() is browser-only');
	return instance ??= new Authenticator();
}
