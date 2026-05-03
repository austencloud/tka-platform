import { browser } from '$app/environment';

import { Authenticator } from './services/implementations/Authenticator';

let instance: Authenticator | null = null;

export function getAuthenticator(): Authenticator {
	if (!browser) throw new Error('getAuthenticator() is browser-only');
	return instance ??= new Authenticator();
}
