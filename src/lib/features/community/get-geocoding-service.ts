import { browser } from '$app/environment';

import { Geocoder } from './services/geocoding-service';
import { env } from '$env/dynamic/public';

let instance: Geocoder | null = null;

export function getGeocodingService(): Geocoder {
	if (!browser) throw new Error('getGeocodingService() is browser-only');
	return instance ??= new Geocoder(env.PUBLIC_GOOGLE_MAPS_API_KEY ?? '');
}
