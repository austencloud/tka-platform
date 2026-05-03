import { browser } from '$app/environment';
import { FireDefaultsLoader } from './services/implementations/FireDefaultsLoader';

let instance: FireDefaultsLoader | null = null;

export function getFireDefaultsLoader(): FireDefaultsLoader {
	if (!browser) throw new Error('getFireDefaultsLoader() is browser-only');
	return instance ??= new FireDefaultsLoader();
}
