/**
 * User Location Repository
 * Handles persistence of user location data to Firestore
 */

import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  limit as queryLimit,
  getDocs,
  serverTimestamp,
  type Timestamp,
} from "firebase/firestore";
import { auth, getFirestoreInstance } from "$lib/shared/auth/firebase";
import type {
  UserLocation,
  UserLocationWithProfile,
  LocationSharingPreferences,
} from "../../domain/models/user-location";
export class UserLocationRepository {
  /**
   * Get Firestore document reference for a user's location
   */
  private async getLocationDocRef(userId: string) {
    const firestore = await getFirestoreInstance();
    return doc(firestore, `userLocations/${userId}`);
  }

  /**
   * Get Firestore document reference for location sharing preferences
   */
  private async getPreferencesDocRef(userId: string) {
    const firestore = await getFirestoreInstance();
    return doc(firestore, `users/${userId}/settings/locationSharing`);
  }

  async saveLocation(
    userId: string,
    location: Omit<UserLocation, "userId">
  ): Promise<void> {
    const docRef = await this.getLocationDocRef(userId);

    try {
      await setDoc(docRef, {
        userId,
        ...location,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error(
        "❌ [UserLocationRepository] Failed to save location:",
        error
      );
      throw new Error("Failed to save location. Please try again.");
    }
  }

  async getLocation(userId: string): Promise<UserLocation | null> {
    const docRef = await this.getLocationDocRef(userId);

    try {
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data() as UserLocation;
      }
      return null;
    } catch (error) {
      console.error(
        "❌ [UserLocationRepository] Failed to get location:",
        error
      );
      return null;
    }
  }

  async deleteLocation(userId: string): Promise<void> {
    const docRef = await this.getLocationDocRef(userId);

    try {
      await deleteDoc(docRef);
    } catch (error) {
      console.error(
        "❌ [UserLocationRepository] Failed to delete location:",
        error
      );
      throw new Error("Failed to delete location. Please try again.");
    }
  }

  async getPublicLocations(
    limit: number = 1000
  ): Promise<UserLocationWithProfile[]> {
    const firestore = await getFirestoreInstance();

    try {
      // Get public locations
      const locationsQuery = query(
        collection(firestore, "userLocations"),
        where("visibility", "==", "public"),
        queryLimit(limit)
      );

      const locationsSnapshot = await getDocs(locationsQuery);

      // Handle empty collection gracefully
      if (locationsSnapshot.empty) {
        return [];
      }

      const locations = locationsSnapshot.docs.map((doc) => doc.data() as UserLocation);

      // Fetch user profiles for each location
      const locationsWithProfiles = await Promise.all(
        locations.map(async (location) => {
          const userDocRef = doc(firestore, `users/${location.userId}`);
          const userDocSnap = await getDoc(userDocRef);

          if (!userDocSnap.exists()) {
            return null;
          }

          const userData = userDocSnap.data();

          return {
            ...location,
            username: userData.username || "Unknown",
            displayName: userData.displayName || "Anonymous",
            avatar: userData.avatar,
            totalXP: userData.totalXP || 0,
            currentLevel: userData.currentLevel || 1,
            sequenceCount: userData.sequenceCount || 0,
          } as UserLocationWithProfile;
        })
      );

      // Filter out null values (deleted users)
      return locationsWithProfiles.filter(
        (loc): loc is UserLocationWithProfile => loc !== null
      );
    } catch (error) {
      console.error(
        "❌ [UserLocationRepository] Failed to get public locations:",
        error
      );
      return [];
    }
  }

  async savePreferences(
    userId: string,
    preferences: LocationSharingPreferences
  ): Promise<void> {
    const docRef = await this.getPreferencesDocRef(userId);

    try {
      await setDoc(docRef, {
        ...preferences,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error(
        "❌ [UserLocationRepository] Failed to save preferences:",
        error
      );
      throw new Error(
        "Failed to save location preferences. Please try again."
      );
    }
  }

  async getPreferences(
    userId: string
  ): Promise<LocationSharingPreferences | null> {
    const docRef = await this.getPreferencesDocRef(userId);

    try {
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data() as LocationSharingPreferences;
      }
      return null;
    } catch (error) {
      console.error(
        "❌ [UserLocationRepository] Failed to get preferences:",
        error
      );
      return null;
    }
  }
}
