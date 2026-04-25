import { browser } from '$app/environment';
import type { ILocationSharingOrchestrator } from './services/contracts/ILocationSharingOrchestrator';
import { LocationSharingOrchestrator } from './services/implementations/LocationSharingOrchestrator';
import { getLocationProvider } from './getLocationProvider';
import { getUserLocationRepository } from './getUserLocationRepository';
import { getGeocodingService } from './getGeocodingService';

let instance: ILocationSharingOrchestrator | null = null;

export function getLocationSharingOrchestrator(): ILocationSharingOrchestrator {
	if (!browser) throw new Error('getLocationSharingOrchestrator() is browser-only');
	return instance ??= new LocationSharingOrchestrator(
		getLocationProvider(),
		getUserLocationRepository(),
		getGeocodingService(),
	);
}
