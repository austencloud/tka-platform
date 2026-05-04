/**
 * User Location Repository
 * Handles persistence of user location data to Firestore
 */

import { firestoreGet, firestoreList, firestoreSet, firestoreDelete } from "$lib/shared/firestore";
import { UserLocationSchema } from "../domain/models/user-location-schemas";
import type {
  UserLocation,
  UserLocationWithProfile,
  LocationSharingPreferences,
} from "../domain/models/user-location";
import { z } from "zod";

const LOCATIONS_COLLECTION = "userLocations";

/** Passthrough schema for preferences - no strict validation needed */
const PreferencesSchema = z
  .object({
    hasConsented: z.boolean(),
    consentedAt: z.unknown().optional(),
    visibility: z.enum(["public", "private"]),
  })
  .passthrough();

/** Passthrough schema for user profiles used in the join */
const UserProfileJoinSchema = z
  .object({
    username: z.string().optional(),
    displayName: z.string().optional(),
    avatar: z.string().optional(),
    totalXP: z.number().optional(),
    currentLevel: z.number().optional(),
    sequenceCount: z.number().optional(),
  })
  .passthrough();

function preferencesPath(userId: string): string {
  return `users/${userId}/settings`;
}

export async function saveLocation(
  userId: string,
  location: Omit<UserLocation, "userId">,
): Promise<void> {
  try {
    await firestoreSet(LOCATIONS_COLLECTION, userId, {
      userId,
      ...location,
    } as Record<string, unknown>);
  } catch (error) {
    console.error("❌ [UserLocationRepository] Failed to save location:", error);
    throw new Error("Failed to save location. Please try again.");
  }
}

export async function getLocation(userId: string): Promise<UserLocation | null> {
  try {
    return await firestoreGet(LOCATIONS_COLLECTION, userId, UserLocationSchema) as UserLocation | null;
  } catch (error) {
    console.error("❌ [UserLocationRepository] Failed to get location:", error);
    return null;
  }
}

export async function deleteLocation(userId: string): Promise<void> {
  try {
    await firestoreDelete(LOCATIONS_COLLECTION, userId);
  } catch (error) {
    console.error("❌ [UserLocationRepository] Failed to delete location:", error);
    throw new Error("Failed to delete location. Please try again.");
  }
}

export async function getPublicLocations(
  limit: number = 1000,
): Promise<UserLocationWithProfile[]> {
  try {
    const locations = await firestoreList(LOCATIONS_COLLECTION, UserLocationSchema, {
      where: [{ field: "visibility", op: "==", value: "public" }],
      limit,
    });

    if (locations.length === 0) return [];

    // Join with user profiles
    const locationsWithProfiles = await Promise.all(
      locations.map(async (location) => {
        const profile = await firestoreGet("users", location.userId, UserProfileJoinSchema);
        if (!profile) return null;

        return {
          ...location,
          username: profile.username || "Unknown",
          displayName: profile.displayName || "Anonymous",
          avatar: profile.avatar,
          totalXP: profile.totalXP || 0,
          currentLevel: profile.currentLevel || 1,
          sequenceCount: profile.sequenceCount || 0,
        } as unknown as UserLocationWithProfile;
      }),
    );

    return locationsWithProfiles.filter(
      (loc): loc is UserLocationWithProfile => loc !== null,
    );
  } catch (error) {
    console.error("❌ [UserLocationRepository] Failed to get public locations:", error);
    return [];
  }
}

export async function savePreferences(
  userId: string,
  preferences: LocationSharingPreferences,
): Promise<void> {
  try {
    await firestoreSet(preferencesPath(userId), "locationSharing", preferences as unknown as Record<string, unknown>);
  } catch (error) {
    console.error("❌ [UserLocationRepository] Failed to save preferences:", error);
    throw new Error("Failed to save location preferences. Please try again.");
  }
}

export async function getPreferences(
  userId: string,
): Promise<LocationSharingPreferences | null> {
  try {
    return await firestoreGet(preferencesPath(userId), "locationSharing", PreferencesSchema) as LocationSharingPreferences | null;
  } catch (error) {
    console.error("❌ [UserLocationRepository] Failed to get preferences:", error);
    return null;
  }
}
