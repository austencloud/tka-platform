import { browser } from '$app/environment';
import type { ILocationProvider } from './services/contracts/ILocationProvider';
import { LocationProvider } from './services/implementations/LocationProvider';

let instance: ILocationProvider | null = null;

export function getLocationProvider(): ILocationProvider {
	if (!browser) throw new Error('getLocationProvider() is browser-only');
	return instance ??= new LocationProvider();
}
