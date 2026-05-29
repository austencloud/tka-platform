import { browser } from '$app/environment';

import { GeocodingService } from './services/geocoding-service';
import { env } from '$env/dynamic/public';

let instance: GeocodingService | null = null;

export function getGeocodingService(): GeocodingService {
	if (!browser) throw new Error('getGeocodingService() is browser-only');
	return instance ??= new GeocodingService(env.PUBLIC_GOOGLE_MAPS_API_KEY ?? '');
}
