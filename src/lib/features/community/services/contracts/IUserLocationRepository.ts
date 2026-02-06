/**
 * User Location Repository Interface
 * Handles persistence of user location data to Firestore
 */

import type {
  UserLocation,
  UserLocationWithProfile,
  LocationSharingPreferences,
} from "../../domain/models/user-location";

export interface IUserLocationRepository {
  /**
   * Save or update user's location
   */
  saveLocation(userId: string, location: Omit<UserLocation, "userId">): Promise<void>;

  /**
   * Get a user's location
   */
  getLocation(userId: string): Promise<UserLocation | null>;

  /**
   * Delete a user's location
   */
  deleteLocation(userId: string): Promise<void>;

  /**
   * Get all public locations with profile data for the map
   * @param limit Maximum number of locations to fetch (default 1000)
   */
  getPublicLocations(limit?: number): Promise<UserLocationWithProfile[]>;

  /**
   * Save user's location sharing preferences
   */
  savePreferences(userId: string, preferences: LocationSharingPreferences): Promise<void>;

  /**
   * Get user's location sharing preferences
   */
  getPreferences(userId: string): Promise<LocationSharingPreferences | null>;
}
