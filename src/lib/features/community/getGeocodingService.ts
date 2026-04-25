import { browser } from '$app/environment';
import type { IGeocodingService } from './services/contracts/IGeocodingService';
import { GeocodingService } from './services/implementations/GeocodingService';
import { env } from '$env/dynamic/public';

let instance: IGeocodingService | null = null;

export function getGeocodingService(): IGeocodingService {
	if (!browser) throw new Error('getGeocodingService() is browser-only');
	return instance ??= new GeocodingService(env.PUBLIC_GOOGLE_MAPS_API_KEY ?? '');
}
