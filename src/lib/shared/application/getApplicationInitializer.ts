import { browser } from '$app/environment';
import type { IApplicationInitializer } from './services/contracts/IApplicationInitializer';
import { ApplicationInitializer } from './services/implementations/ApplicationInitializer';

let instance: IApplicationInitializer | null = null;

export function getApplicationInitializer(): IApplicationInitializer {
	if (!browser) throw new Error('getApplicationInitializer() is browser-only');
	return instance ??= new ApplicationInitializer();
}
