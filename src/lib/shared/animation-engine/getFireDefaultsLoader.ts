import { browser } from '$app/environment';
import type { IFireDefaultsLoader } from './services/contracts/IFireDefaultsLoader';
import { FireDefaultsLoader } from './services/implementations/FireDefaultsLoader';

let instance: IFireDefaultsLoader | null = null;

export function getFireDefaultsLoader(): IFireDefaultsLoader {
	if (!browser) throw new Error('getFireDefaultsLoader() is browser-only');
	return instance ??= new FireDefaultsLoader();
}
