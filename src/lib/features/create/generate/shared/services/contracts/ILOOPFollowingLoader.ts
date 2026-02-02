/**
 * ILOOPFollowingLoader
 *
 * Interface for loading LOOP presets from users that the current user follows.
 * Aggregates presets across all followed users.
 */

import type { FollowingPreset } from "../../domain/models/loop-selection-types";

export interface ILOOPFollowingLoader {
  /**
   * Load presets from all users that the current user follows
   *
   * @param userId - The current user's ID
   * @param limit - Maximum number of presets to return (default: 20)
   * @returns Array of presets from followed users, sorted by usageCount descending
   */
  loadFollowingPresets(
    userId: string,
    limit?: number
  ): Promise<FollowingPreset[]>;

  /**
   * Load presets from a specific followed user
   *
   * @param followedUserId - The followed user's ID
   * @returns Array of that user's presets
   */
  loadPresetsFromUser(followedUserId: string): Promise<FollowingPreset[]>;

  /**
   * Check if a user has any public presets
   * Useful for filtering followed users who haven't created any presets
   *
   * @param userId - The user's ID
   * @returns true if user has at least one preset
   */
  hasPresets(userId: string): Promise<boolean>;
}
