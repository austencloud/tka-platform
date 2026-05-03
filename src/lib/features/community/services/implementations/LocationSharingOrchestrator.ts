/**
 * Location Sharing Orchestrator
 * Coordinates location permission, geocoding, and Firebase persistence
 */

import type { UserLocationRepository } from "./UserLocationRepository";
import type {
  UserLocationWithProfile,
  LocationSharingPreferences,
} from "../../domain/models/user-location";
import { Timestamp } from "firebase/firestore";
import type { GeocodingService } from "../implementations/GeocodingService";
import type { LocationProvider } from "../implementations/LocationProvider";

export class LocationSharingOrchestrator {
  constructor(
    private locationProvider: LocationProvider,
    private repository: UserLocationRepository,
    private geocodingService: GeocodingService
  ) {}

  async hasConsented(userId: string): Promise<boolean> {
    const prefs = await this.repository.getPreferences(userId);
    return prefs?.hasConsented ?? false;
  }

  async requestLocationSharing(userId: string): Promise<boolean> {
    try {
      // Get user's exact location (used for geocoding, then discarded)
      const position = await this.locationProvider.getCurrentLocation();

      // Reverse geocode to get city/country and city center coordinates
      const cityLocation = await this.geocodingService.reverseGeocode(
        position.lat,
        position.lng
      );

      // Save ONLY city-level data to Firestore (exact coords are never stored)
      await this.repository.saveLocation(userId, {
        city: cityLocation.city,
        country: cityLocation.country,
        cityCenterCoordinates: cityLocation.cityCenterCoordinates,
        visibility: "public",
        updatedAt: Timestamp.now(),
      });

      // Save consent preferences
      await this.repository.savePreferences(userId, {
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
    const position = await this.locationProvider.getCurrentLocation();

    // Reverse geocode to get city/country and city center coordinates
    const cityLocation = await this.geocodingService.reverseGeocode(
      position.lat,
      position.lng
    );

    // Save ONLY city-level data to Firestore
    await this.repository.saveLocation(userId, {
      city: cityLocation.city,
      country: cityLocation.country,
      cityCenterCoordinates: cityLocation.cityCenterCoordinates,
      visibility: "public",
      updatedAt: Timestamp.now(),
    });
  }

  async removeLocation(userId: string): Promise<void> {
    await this.repository.deleteLocation(userId);

    // Update preferences to remove consent
    await this.repository.savePreferences(userId, {
      hasConsented: false,
      visibility: "private",
    });
  }

  async setVisibility(
    userId: string,
    visibility: "public" | "private"
  ): Promise<void> {
    const location = await this.repository.getLocation(userId);
    if (!location) {
      throw new Error("No location found for user");
    }

    await this.repository.saveLocation(userId, {
      ...location,
      visibility,
      updatedAt: Timestamp.now(),
    });

    const prefs = await this.repository.getPreferences(userId);
    if (prefs) {
      await this.repository.savePreferences(userId, {
        ...prefs,
        visibility,
      });
    }
  }

  async getPublicLocations(): Promise<UserLocationWithProfile[]> {
    return this.repository.getPublicLocations();
  }

  async getPreferences(
    userId: string
  ): Promise<LocationSharingPreferences | null> {
    return this.repository.getPreferences(userId);
  }
}
