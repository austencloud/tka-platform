/**
 * GeoLocation Provider Interface
 *
 * Provides user's geographic location for location-aware features.
 */

export interface UserLocation {
  latitude: number;
  longitude: number;
  timestamp: number;
}

export interface IGeoLocationProvider {
  /**
   * Get the user's current location.
   * Returns cached location if available and fresh (< 1 hour old).
   * Falls back to approximate location based on timezone if geolocation unavailable.
   */
  getLocation(): Promise<UserLocation>;

  /**
   * Get the user's latitude (convenience method).
   * Returns cached value synchronously if available, or default (40°N - NYC area).
   */
  getLatitude(): number;

  /**
   * Check if we have a real location (vs fallback).
   */
  hasRealLocation(): boolean;

  /**
   * Request fresh location from the browser.
   * Will prompt user for permission if not already granted.
   */
  requestFreshLocation(): Promise<UserLocation>;
}
