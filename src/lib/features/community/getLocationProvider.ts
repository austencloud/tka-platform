import { browser } from '$app/environment';

import { LocationProvider } from './services/implementations/LocationProvider';

let instance: LocationProvider | null = null;

export function getLocationProvider(): LocationProvider {
	if (!browser) throw new Error('getLocationProvider() is browser-only');
	return instance ??= new LocationProvider();
}
