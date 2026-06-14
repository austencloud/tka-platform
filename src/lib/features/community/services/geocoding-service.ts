/**
 * Geocoding Service
 * Uses Google Geocoding API to convert coordinates to city/country
 */

import type { CityLocation } from "./types";

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
   * Delegates to the private getCityCenter helper and surfaces it as a public API.
   */
  async forwardGeocode(city: string, country: string): Promise<{ lat: number; lng: number } | null> {
    return this.getCityCenter(city, country);
  }

  /**
   * Get city center coordinates by geocoding the city name
   */
  private async getCityCenter(
    city: string,
    country: string
  ): Promise<{ lat: number; lng: number } | null> {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
          `${city}, ${country}`
        )}&key=${this.apiKey}`
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();

      if (data.status === "OK" && data.results && data.results.length > 0) {
        const location = data.results[0].geometry.location;
        return {
          lat: location.lat,
          lng: location.lng,
        };
      }

      return null;
    } catch (error) {
      console.warn(
        "⚠️ [Geocoder] Failed to get city center, using user coords:",
        error
      );
      return null;
    }
  }
}
