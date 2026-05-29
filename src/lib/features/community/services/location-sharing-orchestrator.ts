/**
 * Location Sharing Orchestrator
 * Coordinates location permission, geocoding, and Firebase persistence
 */

import type {
  UserLocationWithProfile,
  LocationSharingPreferences,
} from "../domain/models/user-location";
import { Timestamp } from "firebase/firestore";
import type { GeocodingService } from "./geocoding-service";
import {
  getCurrentLocation,
} from "./location-provider";
import {
  saveLocation,
  getLocation,
  deleteLocation,
  getPublicLocations,
  savePreferences,
  getPreferences,
} from "./user-location-repository";

export class LocationSharingOrchestrator {
  constructor(
    private geocodingService: GeocodingService
  ) {}

  async hasConsented(userId: string): Promise<boolean> {
    const prefs = await getPreferences(userId);
    return prefs?.hasConsented ?? false;
  }

  async requestLocationSharing(userId: string): Promise<boolean> {
    try {
      // Get user's exact location (used for geocoding, then discarded)
      const position = await getCurrentLocation();

      // Reverse geocode to get city/country and city center coordinates
      const cityLocation = await this.geocodingService.reverseGeocode(
        position.lat,
        position.lng
      );

      // Save ONLY city-level data to Firestore (exact coords are never stored)
      await saveLocation(userId, {
        city: cityLocation.city,
        country: cityLocation.country,
        cityCenterCoordinates: cityLocation.cityCenterCoordinates,
        visibility: "public",
        updatedAt: Timestamp.now(),
      });

      // Save consent preferences
      await savePreferences(userId, {
        hasConsented: true,
        consentedAt: Timestamp.now(),
        visibility: "public",
      });

      return true;
    } catch (error) {
      console.error(
        "❌ [LocationSharingOrchestrator] Failed to share location:",
        error
      );
      return false;
    }
  }

  async updateLocation(userId: string): Promise<void> {
    const hasConsent = await this.hasConsented(userId);
    if (!hasConsent) {
      throw new Error("User has not consented to location sharing");
    }

    // Get user's exact location (used for geocoding, then discarded)
    const position = await getCurrentLocation();

    // Reverse geocode to get city/country and city center coordinates
    const cityLocation = await this.geocodingService.reverseGeocode(
      position.lat,
      position.lng
    );

    // Save ONLY city-level data to Firestore
    await saveLocation(userId, {
      city: cityLocation.city,
      country: cityLocation.country,
      cityCenterCoordinates: cityLocation.cityCenterCoordinates,
      visibility: "public",
      updatedAt: Timestamp.now(),
    });
  }

  async removeLocation(userId: string): Promise<void> {
    await deleteLocation(userId);

    // Update preferences to remove consent
    await savePreferences(userId, {
      hasConsented: false,
      visibility: "private",
    });
  }

  async setVisibility(
    userId: string,
    visibility: "public" | "private"
  ): Promise<void> {
    const location = await getLocation(userId);
    if (!location) {
      throw new Error("No location found for user");
    }

    await saveLocation(userId, {
      ...location,
      visibility,
      updatedAt: Timestamp.now(),
    });

    const prefs = await getPreferences(userId);
    if (prefs) {
      await savePreferences(userId, {
        ...prefs,
        visibility,
      });
    }
  }

  async getPublicLocations(): Promise<UserLocationWithProfile[]> {
    return getPublicLocations();
  }

  async getPreferences(
    userId: string
  ): Promise<LocationSharingPreferences | null> {
    return getPreferences(userId);
  }
}
