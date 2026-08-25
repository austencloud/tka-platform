/**
 * Geocoding Service
 * Uses Google Geocoding API to convert coordinates to city/country
 */

import type { CityLocation } from "./types";

/**
 * A forward geocode, with "no such city" kept distinct from "the geocoder
 * failed".
 *
 * The UI must not promise an error message the geocoder cannot produce: a
 * network failure and a typo need different recovery, and collapsing both to
 * `null` means telling someone their city does not exist when the request
 * never arrived.
 */
export type ForwardGeocodeResult =
  | { status: "found"; coords: { lat: number; lng: number } }
  | { status: "not-found" }
  | { status: "failed"; error: unknown };

export class Geocoder {
  constructor(private apiKey: string) {}

  async reverseGeocode(lat: number, lng: number): Promise<CityLocation> {
    if (!this.apiKey) {
      throw new Error("Location sharing is not available. Google Maps API key not configured.");
    }

    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${this.apiKey}`
      );

      if (!response.ok) {
        throw new Error(`Geocoding API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.status !== "OK" || !data.results || data.results.length === 0) {
        throw new Error(`Geocoding failed: ${data.status}`);
      }

      // Extract city and country from address components
      const result = data.results[0];
      let city = "";
      let country = "";
      let cityCenterLat = lat;
      let cityCenterLng = lng;

      // Parse address components
      for (const component of result.address_components) {
        const types = component.types;

        // Get city (locality or administrative_area_level_2 as fallback)
        if (types.includes("locality")) {
          city = component.long_name;
        } else if (!city && types.includes("administrative_area_level_2")) {
          city = component.long_name;
        } else if (!city && types.includes("administrative_area_level_1")) {
          // State/province as last resort
          city = component.long_name;
        }

        // Get country
        if (types.includes("country")) {
          country = component.long_name;
        }
      }

      // Find city center coordinates by searching for the city
      if (city && country) {
        const cityCenter = await this.getCityCenter(city, country);
        if (cityCenter) {
          cityCenterLat = cityCenter.lat;
          cityCenterLng = cityCenter.lng;
        }
      }

      if (!city || !country) {
        throw new Error("Could not determine city or country from coordinates");
      }

      return {
        city,
        country,
        cityCenterCoordinates: {
          lat: cityCenterLat,
          lng: cityCenterLng,
        },
      };
    } catch (error) {
      console.error("❌ [Geocoder] Reverse geocoding failed:", error);
      throw new Error("Failed to determine your city. Please try again.");
    }
  }

  /**
   * Forward geocode a city + country into lat/lng coordinates.
   *
   * @deprecated Collapses "no such city" and "the request failed" into the same
   * `null`. Use {@link forwardGeocodeCity}. Retained for
   * `FestivalSubmissionForm`, which treats both the same way today.
   */
  async forwardGeocode(city: string, country: string): Promise<{ lat: number; lng: number } | null> {
    const result = await this.forwardGeocodeCity(city, country);
    return result.status === "found" ? result.coords : null;
  }

  /**
   * City-center coordinates for a named city, keeping a miss and a failure
   * distinguishable.
   */
  async forwardGeocodeCity(
    city: string,
    country: string
  ): Promise<ForwardGeocodeResult> {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
          `${city}, ${country}`
        )}&key=${this.apiKey}`
      );

      if (!response.ok) {
        return {
          status: "failed",
          error: new Error(`Geocoding API error: ${response.status}`),
        };
      }

      const data = await response.json();

      if (data.status === "OK" && data.results?.length > 0) {
        const location = data.results[0].geometry.location;
        return { status: "found", coords: { lat: location.lat, lng: location.lng } };
      }

      // ZERO_RESULTS is a real answer: the address does not resolve. Every
      // other status is the API refusing to answer.
      if (data.status === "ZERO_RESULTS") return { status: "not-found" };

      return {
        status: "failed",
        error: new Error(`Geocoding failed: ${data.status}`),
      };
    } catch (error) {
      console.warn("⚠️ [Geocoder] Forward geocode failed:", error);
      return { status: "failed", error };
    }
  }

  /**
   * Get city center coordinates by geocoding the city name
   */
  private async getCityCenter(
    city: string,
    country: string
  ): Promise<{ lat: number; lng: number } | null> {
    return this.forwardGeocode(city, country);
  }
}
