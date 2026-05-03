import { browser } from '$app/environment';
import { LocationSharingOrchestrator } from './services/implementations/LocationSharingOrchestrator';
import { getLocationProvider } from './getLocationProvider';
import { getUserLocationRepository } from './getUserLocationRepository';
import { getGeocodingService } from './getGeocodingService';

let instance: LocationSharingOrchestrator | null = null;

export function getLocationSharingOrchestrator(): LocationSharingOrchestrator {
	if (!browser) throw new Error('getLocationSharingOrchestrator() is browser-only');
	return instance ??= new LocationSharingOrchestrator(
		getLocationProvider(),
		getUserLocationRepository(),
		getGeocodingService(),
	);
}
