/**
 * Location Provider Interface
 * Handles browser geolocation API access
 */

export interface GeolocationPosition {
  lat: number;
  lng: number;
  accuracy: number;
}

export interface GeolocationError {
  code: number;
  message: string;
}

export interface ILocationProvider {
  /**
   * Check if geolocation is supported in this browser
   */
  isSupported(): boolean;

  /**
   * Request user's current location
   * @throws GeolocationError if permission denied or unavailable
   */
  getCurrentLocation(): Promise<GeolocationPosition>;

  /**
   * Watch user's location (for live updates)
   * @param callback Called when location changes
   * @returns Cleanup function to stop watching
   */
  watchLocation(
    callback: (position: GeolocationPosition) => void,
    onError?: (error: GeolocationError) => void
  ): () => void;
}
