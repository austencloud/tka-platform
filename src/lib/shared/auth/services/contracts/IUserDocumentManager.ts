/**
 * IUserDocumentManager
 *
 * Contract for managing user documents in Firestore.
 * Handles creating and updating user profile documents.
 */

import type { User } from "firebase/auth";

export interface IUserDocumentManager {
  /**
   * Create or update a user document in Firestore.
   * Ensures every authenticated user has a corresponding Firestore document
   * that can be displayed in the users browse panel.
   *
   * Creates new document with initial fields if doesn't exist.
   * Updates existing document with latest auth data if exists.
   *
   * @param user - Firebase User object
   * @returns Promise that resolves when document is created/updated
   */
  createOrUpdateUserDocument(user: User): Promise<void>;

  /**
   * Update only the photoURL field for a user's Firestore document.
   * Used when user changes their profile picture without a full auth refresh.
   *
   * @param userId - The user's UID
   * @param photoURL - The new photo URL
   * @returns Promise that resolves when document is updated
   */
  updatePhotoURL(userId: string, photoURL: string): Promise<void>;

  /**
   * Update the user's profile accent color.
   * This color is used for the avatar ring and profile card accents.
   *
   * @param userId - The user's UID
   * @param color - CSS hex color value (e.g. "#8b5cf6")
   * @returns Promise that resolves when document is updated
   */
  updateProfileColor(userId: string, color: string): Promise<void>;
}
