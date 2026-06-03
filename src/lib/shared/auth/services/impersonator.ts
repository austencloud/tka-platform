/**
 * Impersonator
 *
 * Handles admin "View As" impersonation feature.
 * Allows admins to view the app as another user for support/debugging.
 */


import { doc, getDoc } from "firebase/firestore";
import { getFirestoreInstance } from "../firebase";
import type { ImpersonatedUser } from "./types";
import type { UserRole } from "../domain/models/user-role";
import { isAdmin } from "../state/auth-state.svelte";
import { featureFlagService } from "./post-hog-feature-flag-service.svelte";

export class Impersonator {
  private _impersonatedUser: ImpersonatedUser | null = null;

  /**
   * Start impersonating a user (admin only).
   *
   * @param userId - The UID of the user to impersonate
   * @returns Promise with impersonated user data
   */
  async startImpersonation(userId: string): Promise<ImpersonatedUser> {
    // SECURITY: Only admins can impersonate users
    if (!isAdmin()) {
      throw new Error("Unauthorized: Only admins can impersonate users");
    }

    try {
      const firestore = await getFirestoreInstance();
      const userDocRef = doc(firestore, `users/${userId}`);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        throw new Error(`User ${userId} not found`);
      }

      const userData = userDoc.data();
      const role = (userData["role"] || "user") as UserRole;

      this._impersonatedUser = {
        uid: userId,
        email: userData["email"] || null,
        displayName: userData["displayName"] || null,
        photoURL: userData["photoURL"] || null,
        role,
      };

      // Sync impersonated role to feature flag service
      // This ensures canAccessModule() respects the impersonated role
      featureFlagService.setDebugRoleOverride(role);

      return this._impersonatedUser;
    } catch (error) {
      console.error(`❌ [Impersonator] Failed to start impersonation:`, error);
      throw error;
    }
  }

  /**
   * Stop impersonating and return to actual user.
   */
  stopImpersonation(): void {
    this._impersonatedUser = null;
    // Clear the debug role override so feature flags use actual user role
    featureFlagService.clearDebugRoleOverride();
  }

  /**
   * Get current impersonated user (or null if not impersonating).
   */
  getImpersonatedUser(): ImpersonatedUser | null {
    return this._impersonatedUser;
  }

  /**
   * Check if currently impersonating.
   */
  isImpersonating(): boolean {
    return this._impersonatedUser !== null;
  }

  /**
   * Get the effective user ID (impersonated or actual).
   */
  getEffectiveUserId(actualUserId: string | null): string | null {
    if (this._impersonatedUser) {
      return this._impersonatedUser.uid;
    }
    return actualUserId;
  }
}
