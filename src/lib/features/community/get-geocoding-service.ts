import { browser } from "$app/environment";

import { Geocoder } from "./services/geocoding-service";
import { PUBLIC_GOOGLE_MAPS_API_KEY } from "$env/static/public";

let instance: Geocoder | null = null;

export function getGeocodingService(): Geocoder {
  if (!browser) throw new Error("getGeocodingService() is browser-only");
  return (instance ??= new Geocoder(PUBLIC_GOOGLE_MAPS_API_KEY ?? ""));
}
