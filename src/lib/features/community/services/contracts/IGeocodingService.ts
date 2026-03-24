/**
 * Geocoding Service Interface
 * Converts coordinates to city/country and gets city center coordinates
 */

export interface CityLocation {
  city: string;
  country: string;
  cityCenterCoordinates: {
    lat: number;
    lng: number;
  };
}

export interface IGeocodingService {
  /**
   * Reverse geocode coordinates to get city and country
   * Also returns city center coordinates (safe to store/display)
   * @param lat User's latitude (used for geocoding, then discarded)
   * @param lng User's longitude (used for geocoding, then discarded)
   * @returns City name, country, and city center coordinates
   */
  reverseGeocode(lat: number, lng: number): Promise<CityLocation>;

  /**
   * Forward geocode a city + country string into coordinates.
   * Returns the city center lat/lng, or null if the place can't be resolved.
   */
  forwardGeocode(city: string, country: string): Promise<{ lat: number; lng: number } | null>;
}
