/**
 * ILOOPPresetRepository
 *
 * Interface for managing user-created LOOP presets in Firebase.
 * Path: users/{userId}/loopPresets/{presetId}
 */

import type {
  UserLOOPPreset,
  CreateUserPresetInput,
} from "../../domain/models/loop-selection-types";

export interface ILOOPPresetRepository {
  /**
   * Get all presets for a user
   * @param userId - The user's ID
   * @returns Array of user presets, ordered by usageCount descending
   */
  getUserPresets(userId: string): Promise<UserLOOPPreset[]>;

  /**
   * Get a single preset by ID
   * @param userId - The user's ID
   * @param presetId - The preset's ID
   * @returns The preset or null if not found
   */
  getPreset(userId: string, presetId: string): Promise<UserLOOPPreset | null>;

  /**
   * Create a new preset
   * @param userId - The user's ID
   * @param input - The preset data
   * @returns The created preset with generated ID
   */
  createPreset(
    userId: string,
    input: CreateUserPresetInput
  ): Promise<UserLOOPPreset>;

  /**
   * Update an existing preset
   * @param userId - The user's ID
   * @param presetId - The preset's ID
   * @param updates - Partial preset data to update
   */
  updatePreset(
    userId: string,
    presetId: string,
    updates: Partial<CreateUserPresetInput>
  ): Promise<void>;

  /**
   * Delete a preset
   * @param userId - The user's ID
   * @param presetId - The preset's ID
   */
  deletePreset(userId: string, presetId: string): Promise<void>;

  /**
   * Increment the usage count for a preset
   * Called when user applies a preset
   * @param userId - The user's ID
   * @param presetId - The preset's ID
   */
  incrementUsageCount(userId: string, presetId: string): Promise<void>;

  /**
   * Subscribe to user's presets (real-time updates)
   * @param userId - The user's ID
   * @param callback - Called with updated presets
   * @returns Promise resolving to unsubscribe function
   */
  subscribeToUserPresets(
    userId: string,
    callback: (presets: UserLOOPPreset[]) => void
  ): Promise<() => void>;
}
