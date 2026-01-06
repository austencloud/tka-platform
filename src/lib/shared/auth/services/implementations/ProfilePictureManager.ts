/**
 * ProfilePictureManager
 *
 * Handles OAuth provider profile picture management for Firebase Auth users.
 * Manages Facebook and Google profile pictures with proper fallback logic.
 */

import { injectable } from "inversify";
import { updateProfile, type User } from "firebase/auth";
import type { IProfilePictureManager } from "../contracts/IProfilePictureManager";

@injectable()
export class ProfilePictureManager implements IProfilePictureManager {
  /**
   * Update Facebook profile picture to high resolution if needed.
   *
   * Facebook Graph API provides higher resolution pictures than the default Firebase photoURL.
   *
   * IMPORTANT: We SKIP this if user has a Google account linked, because:
   * 1. Google photos are more reliable (don't require access tokens)
   * 2. Facebook Graph API often returns default silhouettes without proper auth
   */
  async updateFacebookProfilePictureIfNeeded(user: User): Promise<void> {
    try {
      // Check if user has Facebook provider
      const facebookData = user.providerData.find(
        (data) => data.providerId === "facebook.com"
      );

      if (!facebookData?.uid) {
        return; // Not a Facebook user
      }

      // IMPORTANT: If user also has Google linked, prefer Google's photo
      // Google photos are more reliable and don't require access tokens
      const hasGoogle = user.providerData.some(
        (data) => data.providerId === "google.com"
      );
      if (hasGoogle) {
        return; // Let Google handle the photo
      }

      // Check if we need to update the profile picture
      // If photoURL already contains graph.facebook.com, skip
      if (user.photoURL?.includes("graph.facebook.com")) {
        return; // Already using Facebook picture
      }

      // If user already has a Google photo URL, don't overwrite it
      if (user.photoURL?.includes("googleusercontent.com")) {
        return; // Keep the Google photo
      }

      // Facebook Graph API URL for high-resolution profile picture
      const photoURL = `https://graph.facebook.com/${facebookData.uid}/picture?type=large`;

      // Update the user's profile with the high-res photo URL
      await updateProfile(user, {
        photoURL: photoURL,
      });
    } catch (err) {
      console.error(
        `❌ [ProfilePictureManager] Failed to update Facebook profile picture:`,
        err
      );
      // Don't throw - this is a non-critical enhancement
    }
  }

  /**
   * Update Google profile picture if needed.
   *
   * Google profile pictures from Firebase Auth contain signed tokens that can expire.
   * Instead of modifying the URL (which can break the signature), we use the
   * provider's photoURL directly which is refreshed on each authentication.
   *
   * IMPORTANT: Google photos are preferred over Facebook because:
   * 1. They don't require access tokens
   * 2. Facebook Graph API often returns default silhouettes
   *
   * Note: We no longer modify the URL size parameter (s96-c -> s400-c) because
   * this was causing stale/broken image URLs. The default 96px image is used
   * and CSS handles scaling.
   */
  async updateGoogleProfilePictureIfNeeded(user: User): Promise<void> {
    try {
      // Check if user has Google provider
      const googleData = user.providerData.find(
        (data) => data.providerId === "google.com"
      );

      if (!googleData?.uid) {
        return; // Not a Google user
      }

      // If user has a Google photo, ALWAYS prefer it over other providers
      // This fixes the issue where Facebook's broken silhouette overwrites Google photos
      if (googleData.photoURL) {
        // Check if current photoURL is NOT a Google URL (e.g., it's a Facebook URL)
        const isCurrentlyGoogle = user.photoURL?.includes(
          "googleusercontent.com"
        );
        const isSameAsProvider = user.photoURL === googleData.photoURL;

        // Update if: no photo, not Google, or different from fresh Google URL
        if (!user.photoURL || !isCurrentlyGoogle || !isSameAsProvider) {
          await updateProfile(user, {
            photoURL: googleData.photoURL,
          });
        }
      }
    } catch (err) {
      console.error(
        `❌ [ProfilePictureManager] Failed to update Google profile picture:`,
        err
      );
      // Don't throw - this is a non-critical enhancement
    }
  }

  /**
   * Get provider-specific IDs for storing in user document.
   * These can be used to construct reliable profile picture URLs.
   */
  getProviderIds(user: User): { googleId?: string; facebookId?: string } {
    const result: { googleId?: string; facebookId?: string } = {};

    for (const provider of user.providerData) {
      if (provider.providerId === "google.com" && provider.uid) {
        result.googleId = provider.uid;
      } else if (provider.providerId === "facebook.com" && provider.uid) {
        result.facebookId = provider.uid;
      }
    }

    return result;
  }
}
