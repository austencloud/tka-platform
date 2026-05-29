import { browser } from '$app/environment';

import { ApplicationInitializer } from './services/application-initializer';

let instance: ApplicationInitializer | null = null;

export function getApplicationInitializer(): ApplicationInitializer {
	if (!browser) throw new Error('getApplicationInitializer() is browser-only');
	return instance ??= new ApplicationInitializer();
}
