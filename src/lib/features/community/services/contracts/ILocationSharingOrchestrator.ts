/**
 * Location Sharing Orchestrator Interface
 * Coordinates the entire location sharing flow
 */

import type {
  UserLocationWithProfile,
  LocationSharingPreferences,
} from "../../domain/models/user-location";

export interface ILocationSharingOrchestrator {
  /**
   * Check if user has already consented to location sharing
   */
  hasConsented(userId: string): Promise<boolean>;

  /**
   * Request location permission and save to Firebase
   * Shows consent UI if needed
   * @returns true if successfully shared, false if declined or failed
   */
  requestLocationSharing(userId: string): Promise<boolean>;

  /**
   * Update user's location (if they've already consented)
   */
  updateLocation(userId: string): Promise<void>;

  /**
   * Remove user's location from the map
   */
  removeLocation(userId: string): Promise<void>;

  /**
   * Toggle visibility between public/private
   */
  setVisibility(userId: string, visibility: "public" | "private"): Promise<void>;

  /**
   * Get all public user locations for the map
   */
  getPublicLocations(): Promise<UserLocationWithProfile[]>;

  /**
   * Get user's current location preferences
   */
  getPreferences(userId: string): Promise<LocationSharingPreferences | null>;
}
