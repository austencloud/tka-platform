/**
 * User Location Models
 * For the global user map feature
 */

import type { Timestamp } from "firebase/firestore";

export interface UserLocation {
  userId: string;

  // City-level location (SAFE - no exact coordinates stored)
  city: string;
  country: string;

  // City center coordinates (for map display, NOT user's actual location)
  cityCenterCoordinates: {
    lat: number;
    lng: number;
  };

  visibility: "public" | "private";
  updatedAt: Timestamp;
}

/**
 * User location with profile data for map markers
 */
export interface UserLocationWithProfile extends UserLocation {
  username: string;
  displayName: string;
  avatar?: string;
  sequenceCount: number;
}

/**
 * Location sharing consent state
 */
export interface LocationSharingPreferences {
  hasConsented: boolean;
  consentedAt?: Timestamp;
  visibility: "public" | "private";
}
