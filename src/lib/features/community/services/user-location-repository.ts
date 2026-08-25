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
  OwnLocationResult,
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
    username: z.string().nullish(),
    displayName: z.string().nullish(),
    avatar: z.string().nullish(),
    sequenceCount: z.number().nullish(),
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

/**
 * @deprecated Collapses "no document" and "read failed" into the same `null`,
 * so a caller cannot tell a user who is not on the map from a user whose
 * document could not be read. Use {@link readOwnLocation}. Retained only for
 * `location-sharing-orchestrator`, which is being removed; delete this with it.
 */
export async function getLocation(userId: string): Promise<UserLocation | null> {
  try {
    return await firestoreGet(LOCATIONS_COLLECTION, userId, UserLocationSchema) as UserLocation | null;
  } catch (error) {
    console.error("❌ [UserLocationRepository] Failed to get location:", error);
    return null;
  }
}

/**
 * Read the signed-in user's own location document, keeping absence and failure
 * distinguishable.
 *
 * Membership on the community map is the existence of this document, and it
 * cannot be derived from `getPublicLocations()`: that query excludes private
 * documents, drops any whose profile join returns null, and is limit-bounded,
 * so a member can be missing from it for three unrelated reasons.
 */
export async function readOwnLocation(userId: string): Promise<OwnLocationResult> {
  try {
    const location = (await firestoreGet(
      LOCATIONS_COLLECTION,
      userId,
      UserLocationSchema,
    )) as UserLocation | null;
    return location ? { status: "found", location } : { status: "absent" };
  } catch (error) {
    console.error("❌ [UserLocationRepository] Failed to read own location:", error);
    return { status: "failed", error };
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
      locations.map(async (location): Promise<UserLocationWithProfile | null> => {
        const profile = await firestoreGet("users", location.userId, UserProfileJoinSchema);
        if (!profile) return null;

        // The list schema parses Firestore timestamps to Date; the domain model
        // types updatedAt as Timestamp. Markers never read it, so map the field
        // explicitly to the domain shape rather than spreading the divergent type.
        const result: UserLocationWithProfile = {
          userId: location.userId,
          city: location.city,
          country: location.country,
          // Named explicitly because this join rebuilds its result field by
          // field. `UserLocationSchema.passthrough()` preserves the key through
          // validation, but anything not assigned here is dropped before it
          // reaches a marker.
          countryCode: location.countryCode,
          cityCenterCoordinates: location.cityCenterCoordinates,
          visibility: location.visibility,
          // Schema-parsed Date vs domain Timestamp don't structurally overlap,
          // so the bridge goes through unknown (markers never read this field).
          updatedAt: location.updatedAt as unknown as UserLocation["updatedAt"],
          username: profile.username ?? "Unknown",
          displayName: profile.displayName ?? "Anonymous",
          avatar: profile.avatar ?? undefined,
          sequenceCount: profile.sequenceCount ?? 0,
        };
        return result;
      }),
    );

    return locationsWithProfiles.filter(
      (loc): loc is UserLocationWithProfile => loc !== null,
    );
  } catch (error) {
    console.error("❌ [UserLocationRepository] Failed to get public locations:", error);
    // Rethrow so the caller can distinguish a load failure from a genuine
    // zero-users result (an empty map should not look like a broken one).
    throw new Error("Failed to load community locations. Please try again.");
  }
}

export async function savePreferences(
  userId: string,
  preferences: LocationSharingPreferences,
): Promise<void> {
  try {
    const data: Record<string, unknown> = {
      hasConsented: preferences.hasConsented,
      visibility: preferences.visibility,
    };
    if (preferences.consentedAt !== undefined) {
      data.consentedAt = preferences.consentedAt;
    }
    await firestoreSet(preferencesPath(userId), "locationSharing", data);
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
