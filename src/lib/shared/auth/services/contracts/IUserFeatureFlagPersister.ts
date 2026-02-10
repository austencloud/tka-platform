/**
 * User Feature Flag Persister Interface
 *
 * Persists per-user feature overrides (enabledFeatures, disabledFeatures,
 * moduleOrder) to Firestore so they apply across devices and can be
 * set by admins for other users.
 */

import type { UserFeatureOverrides } from "../../domain/models/FeatureFlag";

export interface IUserFeatureFlagPersister {
  /**
   * Load user feature overrides from Firestore.
   * Falls back to localStorage if Firestore is unavailable.
   */
  load(userId: string): Promise<UserFeatureOverrides>;

  /**
   * Save user feature overrides to Firestore with localStorage write-through.
   */
  save(userId: string, overrides: UserFeatureOverrides): Promise<void>;

  /**
   * Subscribe to real-time changes for this user's overrides.
   * Enables cross-device sync and admin-initiated changes.
   */
  subscribe(
    userId: string,
    callback: (overrides: UserFeatureOverrides) => void
  ): void;

  /**
   * Clean up Firestore listener.
   */
  dispose(): void;
}
