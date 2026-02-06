/**
 * Animation Storage Service Contract
 *
 * Defines the interface for persisting and retrieving Animation entities
 * from Firestore. Provides CRUD operations for animation configurations.
 */

import type { Animation } from "../../shared/domain/Animation";

export interface IAnimationStorageManager {
  /**
   * Save an animation to Firestore
   * Creates a new animation if it doesn't exist, updates if it does
   *
   * @param animation - The animation to save
   * @returns Promise that resolves when save is complete
   * @throws Error if save fails
   */
  save(animation: Animation): Promise<void>;

  /**
   * Load an animation by ID from Firestore
   *
   * @param userId - The user who owns the animation
   * @param animationId - The ID of the animation to load
   * @returns Promise that resolves to the animation, or null if not found
   * @throws Error if load fails
   */
  load(userId: string, animationId: string): Promise<Animation | null>;

  /**
   * List all animations for a user
   *
   * @param userId - The user whose animations to list
   * @param limit - Maximum number of animations to return (default: 50)
   * @returns Promise that resolves to array of animations
   * @throws Error if list fails
   */
  list(userId: string, limit?: number): Promise<Animation[]>;

  /**
   * Delete an animation from Firestore
   *
   * @param userId - The user who owns the animation
   * @param animationId - The ID of the animation to delete
   * @returns Promise that resolves when delete is complete
   * @throws Error if delete fails
   */
  delete(userId: string, animationId: string): Promise<void>;

  /**
   * Duplicate an animation
   * Creates a copy with a new ID and updated timestamps
   *
   * @param userId - The user who owns the animation
   * @param animationId - The ID of the animation to duplicate
   * @param newName - Optional new name for the duplicate
   * @returns Promise that resolves to the duplicated animation
   * @throws Error if animation not found or duplicate fails
   */
  duplicate(
    userId: string,
    animationId: string,
    newName?: string
  ): Promise<Animation>;

  /**
   * Check if an animation exists
   *
   * @param userId - The user who owns the animation
   * @param animationId - The ID of the animation to check
   * @returns Promise that resolves to true if exists, false otherwise
   */
  exists(userId: string, animationId: string): Promise<boolean>;

  /**
   * Get the total count of animations for a user
   *
   * @param userId - The user whose animations to count
   * @returns Promise that resolves to the count
   */
  count(userId: string): Promise<number>;
}
